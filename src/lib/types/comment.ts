export type Platform = 'bsky' | 'twitter' | 'threads' | 'combined';

export type CommentUser = {
  id?: string;
  handle?: string;
  displayName?: string;
};

export type Comment = {
  id: string;
  matchId: string;
  platform?: Platform;
  user?: CommentUser;
  parentId?: string | null;
  text: string;
  createdAt: string;
  status: 'active' | 'deleted';
};
