export type TagInfo = { tag: string; count: number; promoted: boolean };

export type TagTreeNode = {
  segment: string;
  full_tag: string;
  own_count: number;
  descendant_count: number;
  children: TagTreeNode[];
};
