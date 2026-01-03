# Thread Display Exploration (Issue #80)

This document explores alternative approaches for displaying threads in xfeed, moving away from the current flat reply-list implementation to a more intuitive native thread display.

## Current Implementation Analysis

### What We Have Now

The current `PostDetailScreen` displays threads as:

```
┌─────────────────────────────────────┐
│ Replying to @parent                 │  ← Only immediate parent
│ [truncated parent text...]          │
└─────────────────────────────────────┘

@author · Jan 3, 2026 · 10:30 AM
Full tweet content here...

Stats: 10 replies · 5 reposts · 20 likes

─── Replies (3) ───
> @reply1 · 15m ago       ← Flat list, no hierarchy
  First reply text...

  @reply2 · 10m ago       ← All at same indentation
  Second reply text...

  @reply3 · 5m ago
  Third reply text...
```

### Current Limitations

1. **No ancestor chain**: Only shows immediate parent, not grandparent/great-grandparent
2. **Flat reply list**: All replies shown at same level, no nesting
3. **No reply relationships**: Can't see which reply is responding to which
4. **Underutilized API**: `getThread()` exists but isn't used—it returns all tweets in conversation
5. **Lost context**: When drilling into a reply, lose sight of the broader conversation

### Available Data

The API provides:
- `inReplyToStatusId`: Parent tweet ID (establishes parent-child links)
- `conversationId`: Groups all tweets in a thread together
- `getThread(tweetId)`: Returns all tweets in conversation, sorted by time
- `getReplies(tweetId)`: Returns direct replies only

---

## Proposed Approaches

### Approach A: Linear Thread with Ancestor Chain

Show the full ancestor chain leading to the focused tweet, then replies below with visual hierarchy.

**Visual Design:**

```
╭─ Thread Context ─────────────────────────────────╮
│ @grandparent · 3h                                │
│ This is where the conversation started...        │
│ │                                                │
│ └─ @parent · 2h                                  │
│    Replying to the original tweet here...        │
╰──────────────────────────────────────────────────╯

@author · Jan 3, 2026 · 10:30 AM      ← FOCUSED TWEET
Full tweet content with all the details that
the user wants to read about...

📊 10 replies · 5 reposts · 20 likes

╭─ Replies ────────────────────────────────────────╮
│ > @user1 · 15m                                   │  ← Selected
│   First reply to the main tweet                  │
│   │                                              │
│   └─ @user4 · 10m                                │  ← Reply to reply
│      Nested reply showing hierarchy              │
│                                                  │
│   @user2 · 12m                                   │
│   Another direct reply                           │
│                                                  │
│   @user3 · 5m                                    │
│   Third reply to main tweet                      │
╰──────────────────────────────────────────────────╯
```

**Pros:**
- Clear visual hierarchy with tree characters
- Shows full context above focused tweet
- Reveals reply-to-reply relationships
- Natural reading flow (top to bottom)

**Cons:**
- More complex layout calculations
- Deep threads may require horizontal scrolling or truncation

**Implementation Notes:**
- Build ancestor chain by recursively fetching `inReplyToStatusId`
- Use `getThread()` for replies, then build tree structure from `inReplyToStatusId` relationships
- Tree characters: `│` (vertical), `├─` (branch), `└─` (last branch)

---

### Approach B: Full Conversation Timeline

Display the entire conversation as a chronological timeline with the focused tweet highlighted.

**Visual Design:**

```
╭─ Conversation ───────────────────────────────────╮
│                                                  │
│ ○ @root · 4h                                     │  ← Thread start
│ │ Original post that started everything          │
│ │                                                │
│ ├─○ @user2 · 3h                                  │
│ │   Reply to root                                │
│ │   │                                            │
│ │   └─○ @user3 · 2.5h                            │
│ │       Nested reply                             │
│ │                                                │
│ └─● @author · 2h                ═══ YOU ═══      │  ← Highlighted
│     THE FOCUSED TWEET CONTENT                    │
│     Shown with emphasis/background               │
│     │                                            │
│     ├─○ @reply1 · 1h                             │
│     │   Reply to your tweet                      │
│     │                                            │
│     └─○ @reply2 · 30m                            │
│         Another reply                            │
│                                                  │
╰──────────────────────────────────────────────────╯
```

**Pros:**
- Complete conversation context at a glance
- Natural Twitter/X-like experience
- Shows all relationships clearly
- Can navigate entire thread with j/k

**Cons:**
- May be overwhelming for large threads (100+ tweets)
- Focused tweet may scroll off screen
- Requires fetching entire thread upfront

**Implementation Notes:**
- Use `getThread()` to fetch all tweets
- Build tree structure using `inReplyToStatusId` relationships
- Use `●` for focused tweet, `○` for others
- Implement "jump to focused" with `g` key

---

### Approach C: Split View (Thread Outline + Detail)

Two-panel layout: left shows thread structure as an outline, right shows selected tweet details.

**Visual Design:**

```
┌─ Thread ────────────┬─ Detail ───────────────────────┐
│                     │                                │
│ ○ @root             │  @user2 · Jan 3, 2026          │
│ ├─● @user2  ← SEL   │                                │
│ │  └─○ @user3       │  Full tweet content displayed  │
│ └─○ @author ← YOU   │  here with all the details     │
│    ├─○ @reply1      │  that the user wants to see.   │
│    └─○ @reply2      │                                │
│                     │  📊 Stats: 5 replies · 3 likes │
│                     │                                │
│ [j/k] navigate      │  🖼️ Media: 2 images            │
│ [Enter] view        │  🔗 Links: example.com         │
│ [h] back            │                                │
│                     │  ─── Quick Replies ───         │
│                     │  > @user3 commented...         │
│                     │    @user4 also said...         │
│                     │                                │
└─────────────────────┴────────────────────────────────┘
```

**Pros:**
- Always see thread structure
- Navigate without losing context
- Clear spatial mental model
- Good for exploring long threads

**Cons:**
- Reduced horizontal space for content
- More complex keyboard navigation
- May feel cramped on narrow terminals

**Implementation Notes:**
- Left panel: ~25-30 chars wide (username + indicators)
- Right panel: remaining width for detail
- Sync selection between panels
- Left panel shows condensed tree with usernames only

---

### Approach D: Collapsible Sections

Expandable/collapsible thread sections that let users focus on relevant parts.

**Visual Design:**

```
╭─ Thread ─────────────────────────────────────────╮
│                                                  │
│ ▶ @root · 4h  (3 replies)                        │  ← Collapsed
│                                                  │
│ ▼ @author · 2h                  ← FOCUSED        │  ← Expanded
│   Full tweet content here with all details...   │
│   │                                              │
│   ├─▶ @reply1 · 1h  (2 replies)                  │  ← Collapsed branch
│   │                                              │
│   └─▼ @reply2 · 30m                              │  ← Expanded
│       Reply content visible here                 │
│       └─○ @subreply · 15m                        │
│           Deep nested reply                      │
│                                                  │
╰──────────────────────────────────────────────────╯

[Space] toggle · [e] expand all · [c] collapse all
```

**Pros:**
- User controls information density
- Good for very long threads
- Focus on what matters
- Remember collapse state per branch

**Cons:**
- Hidden content by default
- More interaction required
- State management complexity

**Implementation Notes:**
- Track collapsed state per tweet ID
- `▶` for collapsed (has hidden children), `▼` for expanded
- Show child count when collapsed
- Persist collapse state during session

---

## Recommendation: Hybrid Approach (A + D)

Combine **Linear Thread with Ancestor Chain** and **Collapsible Sections**:

1. **Ancestor chain always visible** (not collapsible) — provides essential context
2. **Focused tweet fully expanded** — the main content
3. **Reply branches collapsible** — manage complexity in large threads
4. **Visual tree indicators** — `│ ├ └` characters for hierarchy

**Final Visual Design:**

```
╭─ Replying to ────────────────────────────────────╮
│ @grandparent · 3h                                │
│ Original tweet that started this thread...       │
│ │                                                │
│ └─ @parent · 2h                                  │
│    The reply that @author is responding to       │
╰──────────────────────────────────────────────────╯

@author · Jan 3, 2026 · 10:30 AM
Full tweet content displayed with complete detail.
This is the main focus of the view.

📊 10 replies · 5 reposts · 20 likes
🖼️ 2 images · 🔗 example.com

╭─ Replies ────────────────────────────────────────╮
│ > @user1 · 15m                         [▼]       │  ← Selected, expanded
│   Great point! I totally agree with this.       │
│   │                                              │
│   └─ @user4 · 10m                                │
│      Thanks! Glad you liked it.                  │
│                                                  │
│   @user2 · 12m                         [▶ 3]     │  ← Collapsed, 3 hidden
│   Another perspective on this topic...           │
│                                                  │
│   @user3 · 5m                          [─]       │  ← No children
│   Simple reply with no nested responses          │
╰──────────────────────────────────────────────────╯

[r] replies mode · [Space] toggle branch · [e/c] expand/collapse all
```

---

## Implementation Plan

### Phase 1: Data Layer (API/Hooks)

1. **Add ancestor chain fetching**
   ```typescript
   // New function in usePostDetail or new hook
   async function fetchAncestorChain(tweet: TweetData, client: TwitterClient): Promise<TweetData[]> {
     const ancestors: TweetData[] = [];
     let current = tweet;

     while (current.inReplyToStatusId) {
       const result = await client.getTweet(current.inReplyToStatusId);
       if (!result.success || !result.tweet) break;
       ancestors.unshift(result.tweet); // Add to beginning
       current = result.tweet;
     }

     return ancestors;
   }
   ```

2. **Use getThread() for full conversation**
   - Already implemented in `client.ts:2226-2250`
   - Returns all tweets with same `conversationId`, sorted by time

3. **Build tree structure from flat list**
   ```typescript
   interface ThreadNode {
     tweet: TweetData;
     children: ThreadNode[];
     collapsed: boolean;
   }

   function buildThreadTree(tweets: TweetData[], rootId: string): ThreadNode {
     const map = new Map<string, ThreadNode>();

     // Create nodes
     for (const tweet of tweets) {
       map.set(tweet.id, { tweet, children: [], collapsed: false });
     }

     // Build relationships
     for (const tweet of tweets) {
       if (tweet.inReplyToStatusId && map.has(tweet.inReplyToStatusId)) {
         map.get(tweet.inReplyToStatusId)!.children.push(map.get(tweet.id)!);
       }
     }

     return map.get(rootId) ?? { tweet: tweets[0], children: [], collapsed: false };
   }
   ```

### Phase 2: New Component - ThreadView

Create `src/components/ThreadView.tsx`:

```tsx
interface ThreadViewProps {
  ancestors: TweetData[];      // Chain leading to focused tweet
  focusedTweet: TweetData;     // The main tweet
  replyTree: ThreadNode;       // Tree of replies
  onSelectTweet: (tweet: TweetData) => void;
  selectedId?: string;
  focused?: boolean;
}

export function ThreadView({
  ancestors,
  focusedTweet,
  replyTree,
  onSelectTweet,
  selectedId,
  focused,
}: ThreadViewProps) {
  // Render ancestor chain
  // Render focused tweet (full detail)
  // Render reply tree with collapse/expand
}
```

### Phase 3: Tree Rendering Component

Create `src/components/ThreadTree.tsx`:

```tsx
interface ThreadTreeProps {
  node: ThreadNode;
  depth: number;
  isLast: boolean;
  selectedId?: string;
  onSelect: (tweet: TweetData) => void;
  onToggleCollapse: (tweetId: string) => void;
}

const TREE_CHARS = {
  vertical: '│',
  branch: '├─',
  lastBranch: '└─',
  collapsed: '▶',
  expanded: '▼',
  noChildren: '─',
};

export function ThreadTree({ node, depth, isLast, ... }: ThreadTreeProps) {
  const prefix = depth === 0 ? '' : (isLast ? TREE_CHARS.lastBranch : TREE_CHARS.branch);

  return (
    <box style={{ paddingLeft: depth * 2 }}>
      <box style={{ flexDirection: 'row' }}>
        <text fg="#666666">{prefix}</text>
        <PostCardCompact
          tweet={node.tweet}
          isSelected={node.tweet.id === selectedId}
        />
        {node.children.length > 0 && (
          <text fg="#888888">
            [{node.collapsed ? `▶ ${node.children.length}` : '▼'}]
          </text>
        )}
      </box>
      {!node.collapsed && node.children.map((child, idx) => (
        <ThreadTree
          key={child.tweet.id}
          node={child}
          depth={depth + 1}
          isLast={idx === node.children.length - 1}
          {...restProps}
        />
      ))}
    </box>
  );
}
```

### Phase 4: Keyboard Navigation

Extend keyboard handling for tree navigation:

- `j/k` or `↑/↓`: Navigate between visible nodes
- `h/l` or `←/→`: Collapse/expand current node (or move to parent/child)
- `Space`: Toggle collapse on current node
- `e`: Expand all
- `c`: Collapse all
- `g`: Jump to focused tweet
- `Enter`: Open selected tweet in detail view

### Phase 5: Integration

Update `PostDetailScreen` to use new thread view:

```tsx
export function PostDetailScreen({ tweet, client, ... }: PostDetailScreenProps) {
  const [viewMode, setViewMode] = useState<'detail' | 'thread'>('detail');

  // Existing detail view
  if (viewMode === 'detail') {
    return <CurrentDetailView ... />;
  }

  // New thread view
  return <ThreadView ancestors={ancestors} focusedTweet={tweet} ... />;
}
```

Or create entirely new screen `ThreadScreen.tsx`.

---

## Performance Considerations

1. **Lazy ancestor loading**: Fetch ancestors one-by-one, show progressive loading
2. **Viewport culling**: Use ScrollBox's `viewportCulling` for large threads
3. **Collapse by default**: For threads with 50+ replies, collapse branches by default
4. **Cache thread data**: Store fetched thread in state to avoid re-fetching

---

## UX Considerations

1. **Clear focused tweet indicator**: Different background color or border for "YOU ARE HERE"
2. **Relative timestamps**: "2h" instead of full date for context tweets
3. **Truncated content**: Show first 2-3 lines for context tweets, full for focused
4. **Scroll position**: Auto-scroll to keep focused tweet visible
5. **Breadcrumb navigation**: Allow jumping back to previous focused tweets

---

## Open Questions

1. Should thread view replace detail view, or be a separate mode (toggle with `t`)?
2. How deep should ancestor chain go? (Suggest: max 5-10 levels, show "[+N more]" if deeper)
3. Should collapse state persist across sessions?
4. How to handle very wide threads (many siblings at same level)?

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useThread.ts` | Create | Hook for fetching full thread + building tree |
| `src/components/ThreadView.tsx` | Create | Main thread visualization component |
| `src/components/ThreadTree.tsx` | Create | Recursive tree renderer |
| `src/components/AncestorChain.tsx` | Create | Ancestor chain display |
| `src/components/PostCardCompact.tsx` | Create | Condensed post card for tree view |
| `src/screens/PostDetailScreen.tsx` | Modify | Integrate thread view or add toggle |
| `src/api/client.ts` | Modify | Add helper for ancestor chain fetching |

---

## Success Metrics

1. **Context visibility**: Users can see full conversation path to focused tweet
2. **Relationship clarity**: Clear which replies are responding to which tweets
3. **Navigation efficiency**: Fewer keystrokes to explore thread structure
4. **Performance**: No noticeable lag for threads with 100+ tweets
5. **User preference**: Gather feedback on new vs old approach

---

## Next Steps

1. [ ] Review and approve this exploration document
2. [ ] Prototype ThreadTree component (visual only, hardcoded data)
3. [ ] Implement useThread hook with tree building
4. [ ] Build full ThreadView with keyboard navigation
5. [ ] User testing and feedback
6. [ ] Iterate based on feedback
