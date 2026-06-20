import React from "react";
import { useLocation } from "wouter";

const AVATAR_PALETTE = [
  "#1a3557", "#0d3d2b", "#3b1557", "#5a2d0c",
  "#141457", "#4d0f2e", "#0d4d4d", "#2d4d0d",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface UserAvatarProps {
  name: string;
  username?: string | null;
  userId?: number | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, username, userId, size = 36, className }: UserAvatarProps) {
  const [, navigate] = useLocation();

  const href = username ? `/u/${username}` : userId ? `/user/${userId}` : null;

  const avatar = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(name),
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.9)",
        fontWeight: 600,
        fontSize: Math.max(10, size * 0.35),
        letterSpacing: "-0.02em",
        cursor: href ? "pointer" : "default",
        transition: href ? "opacity 0.15s ease, transform 0.15s ease" : undefined,
      }}
      className={className}
      onClick={href ? (e) => { e.stopPropagation(); navigate(href); } : undefined}
      onMouseEnter={href ? e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"; } : undefined}
      onMouseLeave={href ? e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; } : undefined}
      title={href ? `View ${name}'s profile` : name}
    >
      {initials(name)}
    </div>
  );

  return avatar;
}

interface UserNameLinkProps {
  name: string;
  username?: string | null;
  userId?: number | null;
  style?: React.CSSProperties;
  className?: string;
}

export function UserNameLink({ name, username, userId, style, className }: UserNameLinkProps) {
  const [, navigate] = useLocation();
  const href = username ? `/u/${username}` : userId ? `/user/${userId}` : null;

  if (!href) {
    return <span style={style} className={className}>{name}</span>;
  }

  return (
    <span
      style={{ cursor: "pointer", ...style }}
      className={className}
      onClick={e => { e.stopPropagation(); navigate(href); }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
    >
      {name}
    </span>
  );
}
