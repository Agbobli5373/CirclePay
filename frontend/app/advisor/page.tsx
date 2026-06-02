'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Sparkles, Send } from 'lucide-react'
import { FundConfigurationCard } from '@/components/fund-configuration-card'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  hasConfig?: boolean
  configData?: {
    fundType: 'Susu' | 'Medical'
    beneficiary?: string
    location?: string
    target: number
    payoutMethod: string
    shareableLink: boolean
  }
}

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'What do you need to organise money for?',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const exampleChips = [
    'Weekly savings with my market group',
    "Raise money for my mum's surgery",
    "Save for my child's school fees",
  ]

  const handleExampleClick = (example: string) => {
    setInput(example)
  }

  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response with config recommendation
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          input.toLowerCase().includes('medical') || input.toLowerCase().includes('surgery') || input.toLowerCase().includes('hospital')
            ? "I recommend a Medical Fund for urgent healthcare needs. This fund collects money quickly and ensures funds go directly to medical providers. Here's what I configured:"
            : input.toLowerCase().includes('traders') || input.toLowerCase().includes('group') || input.toLowerCase().includes('market')
            ? "Perfect! A Susu (rotating savings) fund is ideal for group savings. Each member contributes regularly and receives a lump sum on their turn. Here's the setup I recommend:"
            : input.toLowerCase().includes('school') || input.toLowerCase().includes('education') || input.toLowerCase().includes('fees')
            ? "Great! An Education Fund helps you save for school expenses with community support. Here's what I configured for you:"
            : 'Excellent! Let me create a fund tailored to your needs:',
        hasConfig: true,
        configData:
          input.toLowerCase().includes('medical') || input.toLowerCase().includes('surgery') || input.toLowerCase().includes('hospital')
            ? {
                fundType: 'Medical',
                beneficiary: 'Family member',
                location: 'Nearest hospital',
                target: 5000,
                payoutMethod: 'Direct to provider',
                shareableLink: true,
              }
            : input.toLowerCase().includes('school') || input.toLowerCase().includes('education') || input.toLowerCase().includes('fees')
            ? {
                fundType: 'Susu',
                target: 500,
                payoutMethod: 'Lump sum at end of cycle',
                shareableLink: true,
              }
            : {
                fundType: 'Susu',
                target: 500,
                payoutMethod: 'Rotating payout',
                shareableLink: true,
              },
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasConfig = messages.some((m) => m.hasConfig)
  const latestConfig = [...messages].reverse().find((m) => m.hasConfig)?.configData

  return (
    <AppShell currentPage="home" title="AI Fund Advisor">
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
      <div className="max-w-2xl mx-auto w-full h-[calc(100vh-200px)] flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What do you need to organise money for?
          </h2>
          <p className="text-sm text-secondary mt-1">Describe your goal in plain language — I&apos;ll set up the right fund.</p>
        </div>
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' ? (
                <div className="flex gap-3 max-w-2xl">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-card border border-border p-4 text-foreground">
                      {message.content}
                    </div>
                    {message.hasConfig && message.configData && (
                      <div className="lg:hidden">
                        <FundConfigurationCard config={message.configData} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl rounded-xl bg-primary text-primary-foreground p-4">
                  {message.content}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-xl bg-card border border-border p-4">
                  <p className="text-secondary text-sm">Thinking…</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Example Chips (only show if no config yet) */}
        {!hasConfig && messages.length === 1 && !isLoading && (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-secondary">Try one of these:</p>
            <div className="grid gap-2 md:grid-cols-3">
              {exampleChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(chip)}
                  className="text-left text-sm p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 bg-card transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need..."
            className="flex-1 p-3 rounded-lg border border-border bg-card text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-fit p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-secondary transition-colors flex items-center justify-center"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop config side panel */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          {latestConfig ? (
            <FundConfigurationCard config={latestConfig} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Your fund setup</p>
              <p className="text-xs text-secondary mt-1">
                Once you describe your goal, I&apos;ll show a ready-to-confirm configuration here.
              </p>
            </div>
          )}
        </div>
      </aside>
      </div>
    </AppShell>
  )
}
