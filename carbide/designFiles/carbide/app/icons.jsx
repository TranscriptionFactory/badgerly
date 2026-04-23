// Lucide-style stroked icons (1.5 stroke), matching Carbide's feather/lucide usage.
const Ic = ({ d, size = 16, fill, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill={fill || "none"} stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {d}
  </svg>
);

const Icons = {
  Files: (p) => <Ic {...p} d={<><path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M13 3v5h5"/></>} />,
  Search: (p) => <Ic {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>} />,
  Branch: (p) => <Ic {...p} d={<><circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 6v12"/><path d="M18 10v1a4 4 0 0 1-4 4H8"/></>} />,
  Graph: (p) => <Ic {...p} d={<><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6.5 7.5 11 17"/><path d="M17.5 7.5 13 17"/><path d="M7 6h10"/></>} />,
  Tasks: (p) => <Ic {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m8 12 3 3 5-6"/></>} />,
  Tag: (p) => <Ic {...p} d={<><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9Z"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></>} />,
  Settings: (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>} />,
  ChevronR: (p) => <Ic {...p} d={<path d="m9 6 6 6-6 6"/>} />,
  ChevronD: (p) => <Ic {...p} d={<path d="m6 9 6 6 6-6"/>} />,
  ChevronL: (p) => <Ic {...p} d={<path d="m15 6-6 6 6 6"/>} />,
  Dot: (p) => <Ic {...p} d={<circle cx="12" cy="12" r="3" fill="currentColor"/>} />,
  Folder: (p) => <Ic {...p} d={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>} />,
  FolderOpen: (p) => <Ic {...p} d={<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"/><path d="m3 10 2 9a1 1 0 0 0 1 1h12.5a1 1 0 0 0 1-.8L22 11H5"/></>} />,
  File: (p) => <Ic {...p} d={<><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/></>} />,
  Check: (p) => <Ic {...p} d={<path d="m5 12 5 5L20 7"/>} />,
  Plus: (p) => <Ic {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />,
  Minus: (p) => <Ic {...p} d={<path d="M5 12h14"/>} />,
  Undo: (p) => <Ic {...p} d={<><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7"/></>} />,
  Upload: (p) => <Ic {...p} d={<><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>} />,
  Download: (p) => <Ic {...p} d={<><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></>} />,
  Sync: (p) => <Ic {...p} d={<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>} />,
  Clock: (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  Sparkles: (p) => <Ic {...p} d={<><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><path d="m7.5 7.5 2 2M14.5 14.5l2 2M7.5 16.5l2-2M14.5 9.5l2-2"/></>} />,
  Eye: (p) => <Ic {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>} />,
  X: (p) => <Ic {...p} d={<><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>} />,
  More: (p) => <Ic {...p} d={<><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>} />,
  Zap: (p) => <Ic {...p} d={<path d="m13 3-8 11h6l-1 7 8-11h-6Z"/>} />,
  GitCommit: (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M3 12h6"/><path d="M15 12h6"/></>} />,
  Restore: (p) => <Ic {...p} d={<><path d="M3 12a9 9 0 1 0 2.5-6.2"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>} />,
  CircleDot: (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></>} />,
  Cloud: (p) => <Ic {...p} d={<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8 6 6 0 0 0-11.4 2.3A4 4 0 0 0 6 19Z"/>} />,
};

window.Icons = Icons;
