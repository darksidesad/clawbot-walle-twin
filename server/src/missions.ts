import type { MissionPreset } from '../../shared/types.js';

export const MISSION_PRESETS: MissionPreset[] = [
  {
    id: 'search-dog',
    title: 'Search Room & Film Dog',
    subtitle: 'Real camera-FOV room sweep until Biscuit is spotted, then chase & film',
    icon: 'dog',
    command:
      'Sweep the entire room with your camera until you discover Biscuit, then chase and film him!',
    accent: '#38bdf8',
  },
  {
    id: 'tiktok-live',
    title: 'Start TikTok Live!',
    subtitle: 'Launch 9:16 TikTok Live with live robot POV + Screen Share & viewer chat',
    icon: 'radio',
    command:
      'Start a realistic TikTok Live stream right now! Greet the viewers, point your camera at the room, and hype up Cerebras speed!',
    accent: '#f43f5e',
  },
  {
    id: 'instagram-post',
    title: 'Post to Instagram',
    subtitle: 'Snap a live 3D photo from WALL-E’s lens, write caption & publish post',
    icon: 'camera',
    command:
      'Snap a live photo of Biscuit or the room, write a viral caption, and publish it to Instagram!',
    accent: '#e879f9',
  },
  {
    id: 'coding-agents',
    title: 'Coding Agents Briefing',
    subtitle: 'Connect to OpenClaw dev fleet, inspect active PRs & CI with spoken report',
    icon: 'code',
    command:
      'Connect to my OpenClaw coding agents, check active PRs and CI status, and give me a spoken engineering briefing!',
    accent: '#22c55e',
  },
  {
    id: 'obsidian-sync',
    title: 'Obsidian Vault Sync',
    subtitle: 'Open backlink knowledge graph & append today’s robotics mission note',
    icon: 'book',
    command:
      "Open my Obsidian knowledge vault, show the backlink graph, and log today's robotics mission to my daily note!",
    accent: '#a855f7',
  },
  {
    id: 'analytics-charts',
    title: 'Live Analytics & Charts',
    subtitle: 'Live Cerebras tok/s sparkline, 40 tok/s speedup bars & Triad telemetry',
    icon: 'chart',
    command:
      'Open the live performance analytics dashboard with Cerebras tok/s charts and mission telemetry!',
    accent: '#06b6d4',
  },
  {
    id: 'victory-dance',
    title: 'WALL-E Victory Dance',
    subtitle: 'Excited 360° spin dance with heart eyes followed by a curious scan',
    icon: 'sparkles',
    command:
      'Do an excited spin dance with heart eyes, then scan the room curiously!',
    accent: '#ec4899',
  },
  {
    id: 'mirror-chat',
    title: 'Smart Mirror Chat',
    subtitle: 'Roll to the smart mirror, check reflection, read live viewer comments & reply',
    icon: 'mirror',
    command:
      'Roll up to the smart mirror, check yourself out, read the live viewer comments on the mirror, and reply out loud!',
    accent: '#22d3ee',
  },
];
