"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getConfirmState, subscribeConfirm, resolveConfirm } from "@/lib/confirm-dialog"

export function GlobalConfirmDialog() {
  const [options, setOptions] = React.useState<ReturnType<typeof getConfirmState>>(null)

  React.useEffect(() => {
    const unsubscribe = subscribeConfirm((newOptions) => {
      setOptions(newOptions)
    })
    return unsubscribe
  }, [])

  const handleConfirm = () => {
    resolveConfirm(true)
  }

  const handleCancel = () => {
    resolveConfirm(false)
  }

  return (
    <AlertDialog open={!!options} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {options?.title && <AlertDialogTitle>{options.title}</AlertDialogTitle>}
          {options?.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options?.cancelText || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              options?.variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {options?.confirmText || "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

