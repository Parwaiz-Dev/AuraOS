/**
 * Public website routes — no authentication.
 *
 * Serves the data the Next.js website needs to render a tenant's site:
 *   GET /api/v1/public/site/:slug/config   — branding, theme, hours, features
 *   GET /api/v1/public/site/:slug/gallery  — active gallery images
 *   GET /api/v1/public/site/:slug/page/:key — a single editable page's content
 *
 * Read-only and tenant-scoped by the :slug param. PostgreSQL is the source of
 * truth; the host->tenant cache only accelerates routing, not these reads.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError } from '@/shared/errors/AppError';

const router = Router();

async function getRestaurantBySlug(slug: string) {
  const result = await query(
    `SELECT id, name, slug, logo_url, hero_image_url, tagline, description,
            address, phone, whatsapp, public_email, social_links,
            latitude, longitude, map_embed_url, features, website_published
     FROM restaurants WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return result.rows[0] || null;
}

// ─── GET /public/site/:slug/config ──────────────────────────────────────────
router.get('/site/:slug/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const [themeRes, hoursRes] = await Promise.all([
      query(`SELECT primary_color, secondary_color, accent_color, background_color,
                    text_color, font_family
             FROM restaurant_themes WHERE restaurant_id = $1 LIMIT 1`, [restaurant.id]),
      query(`SELECT day_of_week, open_time, close_time, is_closed
             FROM opening_hours WHERE restaurant_id = $1 ORDER BY day_of_week ASC`, [restaurant.id]),
    ]);

    const theme = themeRes.rows[0] || {
      primary_color: '#111827',
      secondary_color: '#f59e0b',
      accent_color: '#10b981',
      background_color: '#ffffff',
      text_color: '#111827',
      font_family: 'Inter',
    };

    res.json(successResponse({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo_url: restaurant.logo_url,
        hero_image_url: restaurant.hero_image_url,
        tagline: restaurant.tagline,
        description: restaurant.description,
        address: restaurant.address,
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        email: restaurant.public_email,
        social_links: restaurant.social_links || {},
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        map_embed_url: restaurant.map_embed_url,
        published: restaurant.website_published,
      },
      theme,
      opening_hours: hoursRes.rows,
      features: restaurant.features || {},
    }));
  } catch (err) {
    next(err);
  }
});

// ─── GET /public/site/:slug/gallery ─────────────────────────────────────────
router.get('/site/:slug/gallery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const result = await query(
      `SELECT id, url, caption, category, sort_order
       FROM gallery_images
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, created_at ASC`,
      [restaurant.id],
    );
    res.json(successResponse(result.rows));
  } catch (err) {
    next(err);
  }
});

// ─── GET /public/site/:slug/page/:key ───────────────────────────────────────
router.get('/site/:slug/page/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const result = await query(
      `SELECT page_key, content, is_published
       FROM website_pages
       WHERE restaurant_id = $1 AND page_key = $2 AND is_published = TRUE
       LIMIT 1`,
      [restaurant.id, req.params.key],
    );

    if (result.rows.length === 0) {
      res.json(successResponse({ page_key: req.params.key, content: {}, is_published: false }));
      return;
    }
    res.json(successResponse(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
