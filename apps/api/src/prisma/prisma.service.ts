import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// In a serverless environment (Vercel Functions) Prisma manages the connection
// pool itself via the DATABASE_URL pgbouncer parameters. Calling $connect() on
// every cold start wastes a connection slot; $disconnect() is never called
// anyway because the function container is killed rather than shut down cleanly.
// Prisma lazily connects on the first query, which is the correct behaviour.
@Injectable()
export class PrismaService extends PrismaClient {}
