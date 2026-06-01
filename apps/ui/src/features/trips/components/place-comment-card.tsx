import { Card } from '@/components/ui/card';
import type { Place } from '../types';
import { Avatar } from './avatar';

type PlaceComment = NonNullable<Place['comments']>[number];

function commentAuthorName(comment: PlaceComment) {
  return comment.user?.name || comment.user?.email || comment.userId || 'Neznámý autor';
}

export function PlaceCommentCard({ comment }: { comment: PlaceComment }) {
  const authorName = commentAuthorName(comment);

  return (
    <Card className="row g10 p-[14px]" style={{ alignItems: 'flex-start' }}>
      <Avatar size="sm" name={authorName} />
      <div className="col g4" style={{ minWidth: 0 }}>
        <span className="t-xs medi">{authorName}</span>
        <span className="t-sm">{comment.body}</span>
      </div>
    </Card>
  );
}
