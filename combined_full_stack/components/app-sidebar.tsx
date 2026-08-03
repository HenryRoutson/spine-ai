"use client"

import { useRouter } from "next/navigation"
import { LayoutGrid } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { AppNavItem } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"
import {
  workspaceNavTabDisabled,
  workspaceNavTabIconClass,
  workspaceNavTabIssue,
  workspaceNavTabTitle,
  type WorkspaceValidity,
} from "@/lib/workspace-validity-ui"

type AppSidebarProps = {
  items: AppNavItem[]
  activeWindow: AppWindowId
  onSelect: (id: AppWindowId) => void
  validity?: WorkspaceValidity
  groupLabel?: string
  consumerFooter?: boolean
}

export function AppSidebar({
  items,
  activeWindow,
  onSelect,
  validity,
  groupLabel = "Workspace",
  consumerFooter = false,
}: AppSidebarProps) {
  const router = useRouter()

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {groupLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((w) => {
                const Icon = w.icon
                const isActive = activeWindow === w.id
                const issue = validity ? workspaceNavTabIssue(w.id, validity) : null
                const disabled = validity ? workspaceNavTabDisabled(w.id, validity) : false
                const title = validity ? workspaceNavTabTitle(w.id, w.label, validity) : w.label

                return (
                  <SidebarMenuItem key={w.id}>
                    <SidebarMenuButton
                      isActive={isActive && !issue}
                      disabled={disabled}
                      tooltip={title}
                      size="sm"
                      onClick={() => {
                        if (disabled) return
                        onSelect(w.id)
                      }}
                      className={cn(
                        issue &&
                          isActive &&
                          "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive data-active:bg-destructive/10 data-active:text-destructive",
                        issue &&
                          !isActive &&
                          "text-destructive hover:bg-destructive/10 hover:text-destructive",
                      )}
                    >
                      <Icon className={cn(workspaceNavTabIconClass(isActive, issue))} />
                      <span>{w.label}</span>
                      <SidebarMenuBadge className="font-mono text-[10px] text-muted-foreground">
                        {w.hint}
                      </SidebarMenuBadge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {consumerFooter ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                tooltip="Build your own pipelines"
                onClick={() => router.push("/projects")}
              >
                <LayoutGrid className="text-muted-foreground" />
                <span>Build pipelines…</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
