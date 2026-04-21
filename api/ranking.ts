/**
 * GET /api/ranking
 *
 * Returns the global top-100 ranking stored in Upstash Redis.
 *
 * Query params:
 *   ?check=<score>  → instead of returning the full ranking,
 *                     returns { position: number | null } for the given score.
 *
 * Setup (one-time):
 *   1. Create a free Redis database at https://console.upstash.com
 *   2. Add env vars to Vercel project dashboard:
 *        UPSTASH_REDIS_REST_URL=<your-url>
 *        UPSTASH_REDIS_REST_TOKEN=<your-token>
 *   3. npm install @upstash/redis --save
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const RANKING_KEY = 'gambler_city_ranking_v1';

function getRedis() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
    return new Redis({ url, token });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers (game is served from same Vercel domain, but be safe)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const redis   = getRedis();
        const ranking = (await redis.get<any[]>(RANKING_KEY)) || [];

        // ?check=<score> — estimate position for a given score
        const checkParam = req.query.check;
        if (checkParam !== undefined) {
            const score = parseInt(String(checkParam), 10);
            if (isNaN(score)) {
                return res.status(400).json({ error: 'Invalid score' });
            }

            const idx = ranking.findIndex((e: any) => score > e.score);
            let position: number | null;

            if (idx === -1) {
                position = ranking.length < 100 ? ranking.length + 1 : null;
            } else {
                position = idx + 1;
            }

            return res.status(200).json({ position });
        }

        return res.status(200).json(ranking);

    } catch (err: any) {
        console.error('[/api/ranking GET]', err);
        return res.status(500).json({ error: 'Internal server error', message: err?.message });
    }
}
