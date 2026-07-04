"use client"

import { StoreProvider } from "@/lib/store"
import { ProjectPickerPage } from "@/components/project-picker-page"

export default function ProjectsRoutePage() {
  return (
    <StoreProvider mode="picker">
      <ProjectPickerPage />
    </StoreProvider>
  )
}
