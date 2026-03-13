# KidCode

A kid-friendly web app that wraps the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) to let kids build things with AI through a chat interface. Think of it as Claude Desktop for kids — type what you want to build, and watch it come to life in a split-view preview.

## How it works

KidCode is a Next.js app with a three-panel layout:

- **Sidebar** — project list with create/delete
- **Chat** — conversation with Claude, streamed in real-time
- **Preview** — live iframe showing whatever Claude builds (HTML games, tools, pages)

When you send a message, KidCode spawns `claude -p` as a child process in the project's subdirectory. Claude's streaming JSON output is parsed and forwarded to the browser via Server-Sent Events. When Claude creates or edits HTML files, the preview pane automatically opens and refreshes.

Each project gets a UUID and its own directory under `public/projects/`. Files Claude creates (HTML, CSS, JS, images) are served via an API route and rendered in the iframe.

A hardcoded system prompt keeps everything G-rated and kid-friendly, and instructs Claude to build things as self-contained HTML files.

## Requirements

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (uses your Claude Max subscription — no API key needed)

## Setup

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Usage

1. Click **Start a New Project**
2. Type what you want to build (e.g. "make me a tic tac toe game")
3. Watch Claude think and build in real-time
4. The preview pane opens automatically when Claude creates an HTML file
5. Ask for changes ("make the colors purple") and the preview updates

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Lato font (self-hosted via fontsource)

## Project structure

```
src/
  app/
    api/
      projects/            # CRUD for projects
        [id]/
          chat/            # SSE streaming chat endpoint
          files/           # Serves project files (HTML, CSS, etc.)
  components/
    chat/                  # Chat bubbles, input, activity indicator
    preview/               # iframe preview panel
    sidebar.tsx            # Project list sidebar
  hooks/
    use-chat.ts            # SSE streaming hook
  lib/
    claude-stream.ts       # Spawns claude CLI, parses stream-json output
    constants.ts           # System prompt
    projects.ts            # Project CRUD (JSON file storage)
    sse.ts                 # SSE response helpers
data/
  projects.json            # Project metadata
public/
  projects/                # Project working directories (gitignored)
```

## How the CLI wrapper works

KidCode spawns Claude Code as a subprocess:

```
claude -p <prompt> \
  --output-format stream-json \
  --dangerously-skip-permissions \
  --verbose \
  --system-prompt <kid-safe prompt> \
  --model sonnet \
  --no-session-persistence \
  --disable-slash-commands
```

The `stream-json` output emits one JSON object per line with types like `assistant` (text + tool use), `result` (final output), and `system` (init/hooks). KidCode parses these to:

- Stream text to the chat UI as it arrives
- Detect tool use (Write, Edit, Bash) and show activity indicators
- Detect file changes and auto-refresh the preview iframe
- Extract a title from the first response to name the project
