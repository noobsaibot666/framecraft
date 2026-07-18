import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CinemaFolder } from "@/types";

interface TreeNode extends CinemaFolder {
  children: TreeNode[];
}

function buildTree(folders: CinemaFolder[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  folders.forEach((f) => nodes.set(f.id, { ...f, children: [] }));
  const roots: TreeNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

interface Props {
  folders: CinemaFolder[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
}

function FolderRow({ node, depth, selectedId, onSelect, onAddChild, onDelete }: {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 h-8 px-2 rounded-sm cursor-pointer transition-precise",
          selectedId === node.id ? "bg-cyan/10 text-white" : "hover:bg-white/6 text-readable"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={cn("shrink-0", !hasChildren && "invisible")}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: node.accent_color ?? "rgba(255,255,255,0.3)" }}
        />
        <span className="font-mono text-[12.5px] truncate flex-1" title={node.name}>{node.name}</span>
        <span
          className={cn(
            "font-mono text-[9px] tracking-widest uppercase shrink-0",
            node.kind === "product" ? "text-amber" : "text-muted"
          )}
        >
          {node.kind === "product" ? "★ PRODUCT" : node.kind}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-precise shrink-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} className="text-muted hover:text-cyan transition-precise" title="Add subfolder">
            <FolderPlus size={11} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-muted hover:text-red transition-precise" title="Delete folder">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {expanded && node.children.map((child) => (
        <FolderRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function FolderTree({ folders, selectedId, onSelect, onAddChild, onDelete }: Props) {
  const tree = useMemo(() => buildTree(folders), [folders]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="system-label">FOLDERS</span>
        <button
          type="button"
          onClick={() => onAddChild(null)}
          className="text-muted hover:text-cyan transition-precise"
          title="Add root folder"
        >
          <FolderPlus size={13} />
        </button>
      </div>
      {tree.length === 0 ? (
        <span className="font-mono text-[11px] text-muted">No folders yet.</span>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tree.map((node) => (
            <FolderRow key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
