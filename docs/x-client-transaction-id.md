# x-client-transaction-id

> Library for generating the `x-client-transaction-id` header required for X API mutations.

## Overview

X's API requires a cryptographically computed `x-client-transaction-id` header for mutation requests (like, bookmark, tweet, retweet). This header cannot be a random value - it must be derived from:

1. The X homepage HTML (contains verification key and animation SVG data)
2. The HTTP method and API path
3. Current timestamp
4. A SHA-256 hash of the above combined with animation interpolation data

Without a valid transaction ID, mutation requests return HTTP 404.

## Integration

The library is vendored from [Lqm1/x-client-transaction-id](https://github.com/Lqm1/x-client-transaction-id) and available in `.context/repos/x-client-transaction-id/`.

### Installation

```bash
bun add x-client-transaction-id
```

### Usage in XClient

```typescript
import { ClientTransaction, handleXMigration } from "x-client-transaction-id";

class XClient {
  private clientTransaction?: ClientTransaction;
  private transactionInitPromise?: Promise<void>;

  // Lazy initialization - fetches X homepage once
  private async ensureClientTransaction(): Promise<void> {
    if (this.clientTransaction) return;
    if (!this.transactionInitPromise) {
      this.transactionInitPromise = (async () => {
        const document = await handleXMigration();
        this.clientTransaction = await ClientTransaction.create(document);
      })();
    }
    await this.transactionInitPromise;
  }

  // Generate transaction ID for a specific request
  private async generateTransactionId(method: string, path: string): Promise<string> {
    await this.ensureClientTransaction();
    if (this.clientTransaction) {
      return this.clientTransaction.generateTransactionId(method, path);
    }
    // Fallback (will likely fail for mutations)
    return randomBytes(16).toString("hex");
  }

  // Use in mutation requests
  async likeTweet(tweetId: string): Promise<ActionResult> {
    const path = `/graphql/${queryId}/FavoriteTweet`;
    const transactionId = await this.generateTransactionId("POST", path);

    const response = await fetch(`https://x.com${path}`, {
      method: "POST",
      headers: {
        "x-client-transaction-id": transactionId,
        // ... other headers
      },
      body: JSON.stringify({ variables: { tweet_id: tweetId } }),
    });
  }
}
```

## How It Works

### 1. Fetch Homepage Document

```typescript
const document = await handleXMigration();
```

This fetches `https://twitter.com/` (redirects to `x.com`) and parses the HTML. The document contains:
- A `<meta name="x-site-verification">` tag with a base64-encoded key
- SVG animation frames in `<svg id="loading-x-anim-*">` elements
- A reference to an "ondemand" JavaScript file with index values

### 2. Extract Cryptographic Material

The `ClientTransaction` class extracts:
- **Key bytes**: From the site verification meta tag
- **Animation data**: SVG path coordinates from loading animation frames
- **Index values**: From X's ondemand.js file (controls which animation frame/row to use)

### 3. Generate Animation Key

Using the extracted data:
1. Select animation frame based on key byte values
2. Parse SVG path `d` attribute for coordinate arrays
3. Apply cubic interpolation to compute color/rotation values
4. Convert to hex string as the "animation key"

### 4. Compute Transaction ID

```typescript
const data = `${method}!${path}!${timestamp}obfiowerehiring${animationKey}`;
const hash = await crypto.subtle.digest("SHA-256", encode(data));
const transactionId = base64Encode(xorWithRandom([...keyBytes, ...timestamp, ...hash]));
```

The final ID is XOR-encrypted with a random byte and base64-encoded.

## Key Files

| File | Purpose |
|------|---------|
| `transaction.ts` | Main `ClientTransaction` class |
| `cubic.ts` | Cubic bezier interpolation for animation |
| `interpolate.ts` | Linear interpolation utilities |
| `rotation.ts` | Rotation matrix conversion |
| `utils.ts` | `handleXMigration()`, hex conversion, helpers |

## Caching

The `ClientTransaction` instance should be reused across requests. The homepage fetch and initialization only needs to happen once per session. In xfeed, we lazy-initialize on first mutation and reuse thereafter.

## Error Handling

If initialization fails (network error, HTML structure changed), mutations will fail with 404. The current implementation logs errors and falls back to random hex (which will fail), allowing read operations to continue working.

## References

- [Lqm1/x-client-transaction-id](https://github.com/Lqm1/x-client-transaction-id) - Original library
- [X's ondemand.js](https://abs.twimg.com/responsive-web/client-web/) - Contains index values (rotates)
- Browser DevTools - Inspect `x-client-transaction-id` header in mutation requests
