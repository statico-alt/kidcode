"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ActivityEvent {
  content: string;
  detail?: string;
}

interface UseChatOptions {
  projectId: string;
  onTitle?: (title: string) => void;
  onFileChange?: (fileName: string) => void;
}

export function useChat({ projectId, onTitle, onFileChange }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activity, setActivity] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const processSSEStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let gotTitle = false;

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: new Date().toISOString() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value as BufferSource, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "text": {
                  let text = event.content as string;
                  if (!gotTitle) {
                    const titleMatch = text.match(/^TITLE:\s*.+\n*/m);
                    if (titleMatch) {
                      text = text.replace(/^TITLE:\s*.+\n*/m, "");
                      gotTitle = true;
                    }
                  }
                  assistantText += text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: assistantText,
                    };
                    return updated;
                  });
                  break;
                }
                case "title":
                  gotTitle = true;
                  onTitle?.(event.content);
                  break;
                case "activity":
                  setActivity(event.content);
                  break;
                case "file-change":
                  onFileChange?.(event.content);
                  setActivity(`Updated ${event.content}`);
                  break;
                case "error":
                  assistantText += `\n\nError: ${event.content}`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: assistantText,
                    };
                    return updated;
                  });
                  break;
                case "done":
                  break;
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    },
    [onTitle, onFileChange]
  );

  const loadHistory = useCallback(async () => {
    try {
      // First check for active session to reconnect to
      const reconnectRes = await fetch(`/api/projects/${projectId}/chat?reconnect=1`);

      if (reconnectRes.headers.get("Content-Type")?.includes("text/event-stream")) {
        // Active session found — load saved history first, then stream remaining
        const historyRes = await fetch(`/api/projects/${projectId}/chat`);
        if (historyRes.ok) {
          const data = await historyRes.json();
          setMessages(data);
        }

        setIsLoading(true);
        setActivity("Reconnecting...");

        const reader = reconnectRes.body!.getReader();
        await processSSEStream(reader);

        setIsLoading(false);
        setActivity("");

        // Reload history to get the final saved state
        const finalRes = await fetch(`/api/projects/${projectId}/chat`);
        if (finalRes.ok) {
          const data = await finalRes.json();
          setMessages(data);
        }
        return;
      }

      // No active session — just load history normally
      const res = await fetch(`/api/projects/${projectId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // ignore
    }
  }, [projectId, processSSEStream]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setActivity("");

      try {
        abortRef.current = new AbortController();
        const res = await fetch(`/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        await processSSEStream(reader);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + `\n\nSorry, something went wrong. Please try again!`,
              };
            }
            return updated;
          });
        }
      } finally {
        setIsLoading(false);
        setActivity("");
        abortRef.current = null;
      }
    },
    [projectId, isLoading, processSSEStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, setMessages, isLoading, activity, sendMessage, stop, loadHistory };
}
