"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type SessionUser } from "@/lib/auth-types";
import { visibleSections } from "./nav-items";

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 248;
const COLLAPSED_WIDTH = 60;

const WIDTH_KEY = "keihi.sidebar.width";
const COLLAPSED_KEY = "keihi.sidebar.collapsed";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const draggingRef = useRef(false);

  // 前回の幅・折りたたみ状態を復元する
  useEffect(() => {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    if (w >= MIN_WIDTH && w <= MAX_WIDTH) setWidth(w);
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    setHydrated(true);
  }, []);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      draggingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX));
        setWidth(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setWidth((w) => {
          localStorage.setItem(WIDTH_KEY, String(w));
          return w;
        });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [collapsed],
  );

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  }

  const sections = visibleSections(user.role);
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : width;

  // /expenses と /expenses/new のように前方一致が重なる場合、
  // 完全一致するメニューがあればそちらだけをアクティブにする
  const hasExactMatch = sections.some((s) =>
    s.items.some((i) => i.href === pathname),
  );

  return (
    <aside
      style={{ width: effectiveWidth }}
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        // ドラッグ中はトランジションを切って追従させる
        hydrated && !draggingRef.current && "transition-[width] duration-150",
      )}
    >
      {/* ロゴ */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <span className="font-display text-2xl font-semibold text-primary">
            E
          </span>
        ) : (
          <div className="overflow-hidden">
            <p className="font-display truncate text-xl font-semibold text-primary">
              Expense Portal
            </p>
            <p className="truncate text-[11px] text-muted-foreground font-ui">
              経費管理システム
            </p>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-ui">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5 px-2">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (!hasExactMatch &&
                    item.href !== "/dashboard" &&
                    pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-ui transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent",
                        item.comingSoon && !active && "opacity-55",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!collapsed && item.comingSoon && (
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                          準備中
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ユーザー情報 + ログアウト */}
      <div className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <div className="mb-1.5 px-2 py-1">
            <p className="truncate text-sm font-medium font-ui">{user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground font-ui">
              {ROLE_LABEL[user.role]}
              {user.departmentName ? ` · ${user.departmentName}` : ""}
            </p>
          </div>
        )}
        <form action="/api/logout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn("w-full", collapsed && "w-auto mx-auto")}
            title="ログアウト"
          >
            <LogOut className="size-4" />
            {!collapsed && <span className="flex-1 text-left">ログアウト</span>}
          </Button>
        </form>
      </div>

      {/* 折りたたみトグル */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
        className="absolute -right-3 top-[70px] z-20 flex size-6 items-center justify-center rounded-full border border-sidebar-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      {/* 幅ドラッグ用ハンドル */}
      {!collapsed && (
        <div
          onMouseDown={startDrag}
          role="separator"
          aria-orientation="vertical"
          aria-label="サイドバーの幅を調整"
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/25"
        />
      )}
    </aside>
  );
}
