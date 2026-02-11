# API Documentation

This document describes the REST API endpoints available in the NM Legislation Tracker.

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Authentication

Most endpoints are public. Endpoints that require authentication use NextAuth.js session cookies. Authenticated endpoints are marked with a lock icon.

## Endpoints

### Bills

#### GET /api/legislation/bills

Search and list bills.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by bill number (HB9, SB123) or keyword |
| `status` | number | Filter by status code (1-6) |
| `body` | string | Filter by chamber: "H" (House) or "S" (Senate) |
| `sessionId` | string | Filter by session ID |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50) |

**Status Codes:**
- 1: Introduced
- 2: Engrossed
- 3: Enrolled
- 4: Passed
- 5: Vetoed
- 6: Failed

**Response:**

```json
{
  "bills": [
    {
      "id": "cuid",
      "billId": 12345,
      "billNumber": "HB9",
      "billType": "B",
      "body": "H",
      "title": "Bill Title",
      "description": "Bill description",
      "status": 1,
      "statusDate": "2026-01-15T00:00:00.000Z",
      "session": { ... },
      "sponsors": [ ... ],
      "_count": { "votes": 2 }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

**Notes:**
- Bill number search uses smart prefix matching: "HB9" matches HB9, HB90, HB91 but NOT HB195
- Results are sorted by bill number length (shorter = more relevant) when searching

---

#### GET /api/legislation/bills/[id]

Get a single bill by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Bill CUID or LegiScan bill ID (numeric) |

**Response:**

```json
{
  "id": "cuid",
  "billId": 12345,
  "billNumber": "HB9",
  "title": "Bill Title",
  "description": "Bill description",
  "status": 1,
  "statusDate": "2026-01-15T00:00:00.000Z",
  "url": "https://legiscan.com/...",
  "stateLink": "https://nmlegis.gov/...",
  "history": [ ... ],
  "texts": [ ... ],
  "fullText": "Full bill text HTML...",
  "session": { ... },
  "sponsors": [ ... ],
  "votes": [ ... ]
}
```

**Error Responses:**
- 404: Bill not found
- 500: Server error

---

#### POST /api/legislation/bills/[id]/chat

Chat with AI about a specific bill. Requires authentication.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Bill CUID |

**Request Body:**

```json
{
  "message": "What does this bill do?",
  "history": [
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ]
}
```

**Response:**

Returns a streaming response with AI-generated text. Uses Server-Sent Events (SSE) format.

**Error Responses:**
- 400: Message is required
- 401: Unauthorized (not logged in)
- 402: Token limit exceeded (free tier)
- 404: Bill not found / User not found
- 500: Server error

**Notes:**
- Uses Claude 3.5 Haiku via OpenRouter
- Includes full bill text in context when available
- Token usage is tracked per user
- Admins bypass token limits

---

#### GET /api/legislation/bills/[id]/messages

Get chat history for a bill. Requires authentication.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Bill CUID |

**Response:**

```json
{
  "messages": [
    {
      "id": "cuid",
      "role": "user",
      "content": "What does this bill do?",
      "createdAt": "2026-01-15T12:00:00.000Z"
    },
    {
      "id": "cuid",
      "role": "assistant",
      "content": "This bill...",
      "createdAt": "2026-01-15T12:00:05.000Z"
    }
  ]
}
```

**Error Responses:**
- 401: Unauthorized
- 404: Bill not found
- 500: Server error

---

#### DELETE /api/legislation/bills/[id]/messages

Delete all chat messages for a bill. Requires authentication.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Bill CUID |

**Response:**

```json
{
  "success": true
}
```

**Error Responses:**
- 401: Unauthorized
- 500: Server error

---

### Legislators

#### GET /api/legislation/legislators

List all legislators.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or district |
| `party` | string | Filter by party: "D" or "R" |
| `role` | string | Filter by role: "Rep" or "Sen" |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 100) |

**Response:**

```json
{
  "legislators": [
    {
      "id": "cuid",
      "peopleId": 12345,
      "name": "John Smith",
      "firstName": "John",
      "lastName": "Smith",
      "party": "D",
      "role": "Rep",
      "district": "HD-001",
      "email": "john.smith@nmlegis.gov",
      "imageUrl": "https://...",
      "_count": {
        "sponsorships": 15,
        "voteRecords": 200
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 112,
    "totalPages": 2
  }
}
```

**Notes:**
- Results are de-duplicated by lastName + district to handle name variations between data sources
- Sorted by role (Rep before Sen), then by last name

---

#### GET /api/legislation/legislators/[id]

Get a single legislator with voting history.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Legislator CUID or LegiScan people ID (numeric) |

**Response:**

```json
{
  "id": "cuid",
  "peopleId": 12345,
  "name": "John Smith",
  "firstName": "John",
  "lastName": "Smith",
  "party": "D",
  "role": "Rep",
  "district": "HD-001",
  "email": "john.smith@nmlegis.gov",
  "imageUrl": "https://...",
  "bio": { ... },
  "sponsorships": [ ... ],
  "voteRecords": [ ... ],
  "voteStats": {
    "yea": 150,
    "nay": 30,
    "absent": 10,
    "nv": 5
  }
}
```

**Error Responses:**
- 404: Legislator not found
- 500: Server error

---

### Statistics

#### GET /api/legislation/stats

Get overall statistics.

**Response:**

```json
{
  "totals": {
    "bills": 1500,
    "legislators": 112,
    "votes": 500
  },
  "sessions": [
    {
      "id": "cuid",
      "sessionId": 2251,
      "sessionName": "2026 Regular Session",
      "yearStart": 2026,
      "yearEnd": 2026
    }
  ],
  "billsByStatus": [
    { "status": 1, "statusName": "Introduced", "count": 800 },
    { "status": 4, "statusName": "Passed", "count": 100 }
  ],
  "billsByBody": [
    { "body": "H", "bodyName": "House", "count": 750 },
    { "body": "S", "bodyName": "Senate", "count": 750 }
  ],
  "recentBills": [ ... ]
}
```

---

### Sync Status

#### GET /api/legislation/sync-status

Get data synchronization status.

**Response:**

```json
{
  "lastSync": "2026-02-11T10:00:00-07:00",
  "health": "healthy",
  "counts": {
    "bills": 1500,
    "legislators": 112,
    "rollCalls": 500,
    "voteRecords": 10000
  },
  "recentUpdate": {
    "billNumber": "HB123",
    "updatedAt": "2026-02-11T09:55:00.000Z"
  },
  "source": "nmlegis",
  "schedule": {
    "businessHours": "Every 15 minutes (8am-6pm weekdays)",
    "offHours": "Every hour"
  }
}
```

**Health Status:**
- `healthy`: Data is fresh (< 30 min during business hours, < 2 hours otherwise)
- `stale`: Data is older than expected
- `unknown`: Cannot determine sync status

---

### Search History

#### GET /api/legislation/bill-searches

Get recent searches for the logged-in user. Returns empty array if not authenticated.

**Response:**

```json
{
  "searches": [
    {
      "id": "cuid",
      "query": "HB9",
      "updatedAt": "2026-02-11T10:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/legislation/bill-searches

Save a search query. Requires authentication.

**Request Body:**

```json
{
  "query": "HB9"
}
```

**Response:**

```json
{
  "search": {
    "id": "cuid",
    "query": "HB9",
    "updatedAt": "2026-02-11T10:00:00.000Z"
  }
}
```

**Notes:**
- Queries are normalized to uppercase
- Duplicate queries update the timestamp instead of creating new records

**Error Responses:**
- 400: Query is required
- 401: Unauthorized
- 500: Server error

---

#### DELETE /api/legislation/bill-searches

Clear all search history for the logged-in user. Requires authentication.

**Response:**

```json
{
  "success": true
}
```

**Error Responses:**
- 401: Unauthorized
- 500: Server error

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (authentication required)
- 402: Payment Required (token limit exceeded)
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

The API does not currently implement rate limiting. However, the AI chat endpoint tracks token usage per user with a free tier limit.
