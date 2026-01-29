# CodeContest Platform

A production-grade online coding contest platform with comprehensive security, fairness, and reliability guarantees.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Nginx       │────▶│    Frontend     │     │   PostgreSQL    │
│   (WAF/Rate)    │     │  (React/Vite)   │◀────│   (Primary DB)  │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Backend      │◀───▶│     Redis       │     │   Code Runner   │
│  (Node/Express) │     │  (Queue/Cache)  │◀────│ (Docker/cgroups)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Security Model

### Authentication & Authorization
- JWT-based authentication with short-lived access tokens (15 minutes)
- Rotating refresh tokens with 7-day expiry
- Token revocation on logout
- Role-based access control (User, Admin, Contestant)

### Submission Security
- Idempotency keys prevent duplicate submissions
- Code hashing detects identical submissions
- Rate limiting per user (5 submissions/minute)
- Server-enforced cooldown periods

### Code Execution Security
- Docker container isolation
- cgroups v2 for resource limits:
  - CPU quota enforcement
  - Memory limits with OOM killer
  - Process count limits (fork bomb protection)
- seccomp profiles restrict syscalls
- AppArmor profiles for additional hardening
- Network isolation (disabled by default)
- Read-only root filesystem
- No new privileges

### Verdict Authenticity
- Runner responses cryptographically signed
- Backend verifies runner signatures
- Rejects unsigned or mismatched results
- Immutable audit trail for all verdict changes

## Contest Integrity Guarantees

### Deterministic Execution
- Fixed system time within containers
- Fixed locale (C.UTF-8)
- Controlled random seeds
- Identical input produces identical output

### Leaderboard Fairness
- Scoreboard freeze enforced server-side only
- Periodic snapshots during contest
- Final snapshot locked at contest end
- No live recalculation for final ranks

### Anti-Cheating Measures
- Plagiarism detection integration points
- Submission pattern analysis
- IP-based anomaly detection
- Bot detection and mitigation

## Database Schema

### Core Entities
- **Users**: Authentication and profile data
- **Contests**: Contest metadata and scheduling
- **Problems**: Problem statements and constraints
- **Submissions**: Immutable submission records
- **VerdictHistory**: Complete audit trail
- **LeaderboardSnapshots**: Point-in-time standings

### Partitioning Strategy
- Submissions partitioned by contest
- Audit logs partitioned by month
- Automatic archival of old data

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Logout
- `POST /api/auth/logout-all` - Logout all devices

### Contests
- `GET /api/contests` - List contests
- `GET /api/contests/:id` - Get contest details
- `POST /api/contests` - Create contest (Admin)
- `POST /api/contests/:id/register` - Register for contest
- `GET /api/contests/:id/leaderboard` - Get leaderboard

### Submissions
- `GET /api/submissions` - List user submissions
- `GET /api/submissions/:id` - Get submission details
- `GET /api/submissions/:id/status` - Poll submission status
- `POST /api/submissions` - Submit solution

### Admin
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/audit-logs` - View audit logs
- `POST /api/admin/clear-cache` - Clear Redis cache
- `POST /api/admin/contests/:id/finalize` - Finalize contest

## Deployment

### Prerequisites
- Docker 24.0+
- Docker Compose 2.20+
- 8GB RAM minimum
- 50GB disk space

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd coding-platform
```

2. Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the services:
```bash
docker-compose up -d
```

4. Initialize the database:
```bash
docker-compose exec backend npm run db:migrate
```

5. Access the application:
- Frontend: http://localhost
- API: http://localhost/api
- WebSocket: ws://localhost/ws

### Production Deployment

1. Generate strong secrets:
```bash
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # POSTGRES_PASSWORD
```

2. Configure SSL certificates in `infra/nginx/ssl/`

3. Update nginx.conf for HTTPS

4. Deploy with canary strategy:
```bash
docker-compose -f docker-compose.yml -f docker-compose.canary.yml up -d
```

## Monitoring & Operations

### Health Checks
- `/health` - Overall system health
- `/ready` - Readiness probe

### Logging
- Structured JSON logging with Winston
- Audit logs for all critical operations
- Client error reporting

### Metrics
- Queue depth monitoring
- Submission processing times
- Runner utilization
- Database query performance

### Graceful Degradation
- Load shedding under high load
- Queue backpressure
- Read-only contest mode
- Partial availability instead of full outage

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

### Runner
```bash
cd runner
npm install
npm run dev
```

## Testing

### Unit Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Chaos Testing
```bash
./scripts/chaos-test.sh
```

## Security Checklist

- [ ] Change default passwords
- [ ] Generate strong JWT secret
- [ ] Configure HTTPS
- [ ] Enable WAF rules
- [ ] Set up rate limiting
- [ ] Configure CSP headers
- [ ] Enable audit logging
- [ ] Set up log aggregation
- [ ] Configure backup strategy
- [ ] Enable monitoring alerts

## License

MIT License - See LICENSE file for details

## Support

For support, email support@codecontest.io or join our Discord community.
