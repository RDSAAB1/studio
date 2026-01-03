"use client"

// Global non-blocking confirm dialog utility
// This replaces blocking window.confirm() calls

type ConfirmCallback = (confirmed: boolean) => void

interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

let currentResolver: ((value: boolean) => void) | null = null
let currentOptions: ConfirmOptions | null = null
let listeners: Set<(options: ConfirmOptions | null) => void> = new Set()

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    currentResolver = resolve
    currentOptions = options
    listeners.forEach((listener) => listener(options))
  })
}

export function getConfirmState(): ConfirmOptions | null {
  return currentOptions
}

export function subscribeConfirm(callback: (options: ConfirmOptions | null) => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function resolveConfirm(confirmed: boolean) {
  if (currentResolver) {
    currentResolver(confirmed)
    currentResolver = null
    currentOptions = null
    listeners.forEach((listener) => listener(null))
  }
}

// Helper function to replace window.confirm
export async function confirm(message: string, options?: Omit<ConfirmOptions, "description">): Promise<boolean> {
  return showConfirm({
    description: message,
    ...options,
  })
}

