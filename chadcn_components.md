It looks like you are referring to **shadcn/ui chat components** (often typed as "chat cn"). Because shadcn/ui is a "copy-and-paste" component collection rather than a traditional NPM library, the community has built several fantastic, ready-to-use chat component kits based on its design system.

Here is a list of the most popular **shadcn-based chat component libraries and kits**, along with the specific UI components they typically provide:

### 1. shadcn-chat (by Jakob Hoeg)

The most popular community extension, **shadcn-chat**, is a dedicated open-source CLI tool and component library tailored for building chat interfaces. It is built on Next.js, shadcn/ui, and Framer Motion.

* **Key Components Provided:**
* `Chat`: The main wrapper for the chat interface.
* `ChatList`: Renders the list of messages with auto-scrolling.
* `ChatBubble`: Individual message containers with `user` or `ai` variants.
* `ChatInput`: The text area for user input with action buttons (send, attach file, etc.).


* **How to add it:** You can add these directly to your project using a CLI similar to shadcn's original tool (e.g., `npx shadcn-chat add chat`).

### 2. Prompt Kit

Prompt Kit provides a suite of high-quality, open-source shadcn components specifically designed for AI applications, autonomous agents, and chat experiences.

* **Key Components Provided:**
* `PromptInput`: A highly customizable input field that supports multiline auto-sizing and slash commands.
* `MessageThread`: Handles nested or sequential conversation histories.
* `ModelSelector`: A UI dropdown to switch between AI models (e.g., GPT-4, Claude).


* **How to add it:** `npx shadcn@latest add prompt-kit/[component]`.

### 3. chat-components (by miskibin)

This is another highly accessible, customizable repository of ChatGPT-like UI components built specifically using the shadcn/ui design system.

* **Key Components Provided:**
* `Message`: A versatile message component that supports Markdown rendering, custom action buttons (like copy/edit), and inline editing.
* `ChatInput`: A textarea component with tools, loading states, and keyboard shortcut support.
* `GenerationStatus`: A component for displaying AI generation progress with a "Stop Generation" capability.
* *Bonus:* It includes "Thinking model support" (automatically hiding `<think>` tags in collapsible sections for models like DeepSeek or Claude).



### 4. assistant-ui

While slightly more robust, **assistant-ui** is a React library for building production-ready AI chat UIs that integrates seamlessly with shadcn/ui themes.

* **Key Components Provided:**
* `Thread`: The main conversation view.
* `Composer`: The input box equipped with file attachments and speech-to-text.
* `AssistantModal` / `AssistantPopover`: Floating widget versions of the chat for customer support or copilot sidebars.



### 5. shadcn-svelte-extras (For Svelte Users)

If you are using Svelte instead of React, the `shadcn-svelte-extras` ecosystem includes a composable chat component specifically for Svelte 5.

* **Key Components Provided:**
* `Chat.List`: Root container for messages.
* `Chat.Bubble`: Message containers with variant support.
* `Chat.BubbleAvatar`: Inherits from the standard shadcn Avatar component.



---

**Are you looking to build a specific type of chat (like an AI chatbot, a customer support widget, or a WhatsApp-style messaging app)?** Knowing your use case will help me point you to the best starter template!