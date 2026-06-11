import crypto from 'crypto';
import { ordersRepository } from '@/modules/orders/orders.repository';
import { menuRepository } from '@/modules/menu/menu.repository';
import { query } from '@/config/database';
import { MenuItem } from '@/modules/menu/menu.types';

export class WhatsAppService {
  /**
   * Parse a WhatsApp message into order items.
   *
   * Supports multiple natural formats:
   *   "2x Biryani, 1x Naan"           → structured format
   *   "2 biryani and 1 naan"           → natural language
   *   "biryani x2, naan"               → reverse format
   *   "I want 2 biryanis and a lassi"  → conversational
   *   "Biryani - 2, Butter Chicken"    → dash-separated
   */
  private parseOrderText(
    text: string,
    menuItems: MenuItem[],
  ): Array<{ menu_item_id: string; name: string; quantity: number; unit_price: number }> {
    const results: Array<{ menu_item_id: string; name: string; quantity: number; unit_price: number }> = [];
    const usedIds = new Set<string>();

    // ── Normalise text ──────────────────────────────────────────────────────
    const normalised = text
      .toLowerCase()
      .replace(/\band\b/g, ',')   // "and" → comma separator
      .replace(/\bplease\b|\bwant\b|\bi'd like\b|\bget me\b|\border\b/g, '')
      .replace(/[^\w\s,x×\-\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // ── Tokenise by comma / newline ─────────────────────────────────────────
    const segments = normalised.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);

    for (const segment of segments) {
      if (!segment) continue;

      // Extract quantity from various positions:
      //   "2x biryani"  "biryani x2"  "2 biryani"  "biryani 2"  "biryani - 2"
      let qty = 1;
      let itemText = segment;

      // Pattern: leading number  "2 biryani" or "2x biryani"
      const leadMatch = segment.match(/^(\d+)\s*[x×]?\s+(.+)/);
      // Pattern: trailing number "biryani 2" or "biryani x2" or "biryani - 2"
      const trailMatch = segment.match(/^(.+?)\s*[-x×]?\s*(\d+)$/);

      if (leadMatch) {
        qty = parseInt(leadMatch[1], 10);
        itemText = leadMatch[2].trim();
      } else if (trailMatch) {
        itemText = trailMatch[1].trim();
        qty = parseInt(trailMatch[2], 10);
      }

      // Clamp quantity to sane range
      qty = Math.max(1, Math.min(qty, 20));

      // ── Fuzzy match against menu ──────────────────────────────────────────
      const match = this.findBestMatch(itemText, menuItems, usedIds);
      if (match) {
        usedIds.add(match.id);
        results.push({
          menu_item_id: match.id,
          name: match.name,
          quantity: qty,
          unit_price: match.price,
        });
      }
    }

    return results;
  }

  /**
   * Find the best matching menu item for a given text.
   *
   * Confidence tiers (highest to lowest):
   *   1. Exact match               — "biryani" == "Biryani"
   *   2. Search starts with name   — "butter ch" matches "Butter Chicken"
   *   3. Name contains search      — "birya" found in "Biryani"
   *   4. Search contains name      — "biryanis" contains "biryani"
   *      Guard: menu name ≥ 4 chars AND ≥ 60% of search length (prevents
   *      short words like "dal" matching "I want a big meal today")
   *   5. Word overlap              — majority of search words must overlap
   *      (ratio ≥ 0.5, minimum 2 search words) so single-word flukes
   *      like "meal" matching "Meal Box" from a conversational sentence
   *      don't trigger false orders
   *
   * Returns null if no tier reaches its confidence threshold.
   */
  private findBestMatch(
    text: string,
    menuItems: MenuItem[],
    excludeIds: Set<string>,
  ): MenuItem | null {
    const t = text.toLowerCase().trim();
    if (!t || t.length < 2) return null;

    const candidates = menuItems.filter((m) => m.is_active && !excludeIds.has(m.id));

    // 1. Exact match
    const exact = candidates.find((m) => m.name.toLowerCase() === t);
    if (exact) return exact;

    // 2. Search text starts with menu name (user typed a prefix of the dish name)
    const startsWith = candidates.find((m) => m.name.toLowerCase().startsWith(t));
    if (startsWith) return startsWith;

    // 3. Menu name contains the full search text
    const contains = candidates.find((m) => m.name.toLowerCase().includes(t));
    if (contains) return contains;

    // 4. Search text contains the menu name (handles plurals: "biryanis" → "biryani")
    //    Guard: menu name must be at least 4 chars AND at least 60% as long as the
    //    search text — prevents short generic words from matching long phrases.
    const reverse = candidates.find((m) => {
      const mn = m.name.toLowerCase();
      return mn.length >= 4 && mn.length >= t.length * 0.6 && t.includes(mn);
    });
    if (reverse) return reverse;

    // 5. Word overlap — require ≥ 2 search words AND overlap ratio ≥ 0.5
    //    (majority of meaningful words must match, not just one coincidental word)
    const searchWords = t.split(/\s+/).filter((w) => w.length > 2);
    if (searchWords.length < 2) return null; // single-word segment: only exact/contains allowed

    let bestScore = 0;
    let bestRatio = 0;
    let bestMatch: MenuItem | null = null;

    for (const item of candidates) {
      const itemWords = item.name.toLowerCase().split(/\s+/);
      const overlap = searchWords.filter((w) =>
        itemWords.some((iw) => iw.startsWith(w) || w.startsWith(iw)),
      ).length;
      const ratio = overlap / searchWords.length;
      if (overlap > bestScore || (overlap === bestScore && ratio > bestRatio)) {
        bestScore = overlap;
        bestRatio = ratio;
        bestMatch = item;
      }
    }

    // Only return if a clear majority of search words matched
    return bestScore >= 1 && bestRatio >= 0.5 ? bestMatch : null;
  }

  /**
   * Build a menu summary string for the help message.
   * Groups items by category for readability.
   */
  private buildMenuSummary(menuItems: MenuItem[]): string {
    const active = menuItems.filter((m) => m.is_active).slice(0, 15);
    if (active.length === 0) return 'No items available.';
    return active.map((m) => `• ${m.name} — ₹${m.price}`).join('\n');
  }

  /**
   * Process an incoming WhatsApp message.
   * Returns the reply text to send back to the customer.
   */
  async processMessage(
    restaurantId: string,
    phoneNumber: string,
    customerName: string,
    messageText: string,
    messageId: string,
  ): Promise<{ reply: string; orderId: string | null; totalAmount: number }> {
    const text = messageText.trim();

    // ── Handle help / menu request ──────────────────────────────────────────
    const isMenuRequest = /\b(menu|items|what.*have|show.*menu|list)\b/i.test(text);
    if (isMenuRequest || text.length < 3) {
      const menuItems = await menuRepository.findMenuItemsByRestaurantId(restaurantId);
      const summary = this.buildMenuSummary(menuItems);
      return {
        reply: (
          `📋 *Our Menu:*\n${summary}\n\n` +
          `To order, send:\n_2x Biryani, 1x Naan_\nor\n_2 Biryani and 1 Lassi_`
        ),
        orderId: null,
        totalAmount: 0,
      };
    }

    // ── Parse order ─────────────────────────────────────────────────────────
    const menuItems = await menuRepository.findMenuItemsByRestaurantId(restaurantId);
    const parsedItems = this.parseOrderText(text, menuItems);

    if (parsedItems.length === 0) {
      const summary = this.buildMenuSummary(menuItems);
      return {
        reply: (
          `❓ I couldn't find those items.\n\n` +
          `*Available items:*\n${summary}\n\n` +
          `Try: _2x Biryani, 1x Naan_`
        ),
        orderId: null,
        totalAmount: 0,
      };
    }

    // ── Create order ─────────────────────────────────────────────────────────
    // Deduplication: Meta delivers webhooks at-least-once. Check if this
    // message ID was already processed to avoid creating duplicate orders.
    const dupCheck = await query(
      `SELECT id FROM integration_logs
       WHERE restaurant_id = $1 AND source = 'WHATSAPP' AND external_id = $2
       LIMIT 1`,
      [restaurantId, messageId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      return { reply: '', orderId: null, totalAmount: 0 };
    }

    const totalAmount = parsedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = crypto.randomBytes(3).toString('hex');
    const orderNumber = `WA-${restaurantId.slice(0, 8)}-${timestamp}-${suffix}`;

    const notes = `WhatsApp: ${customerName} (${phoneNumber})`;

    try {
      const { order } = await ordersRepository.createOrderWithItems(
        restaurantId,
        null,
        orderNumber,
        'ONLINE',
        'WHATSAPP',
        totalAmount,
        15,
        notes,
        null,
        parsedItems.map((i) => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          special_instructions: null,
          status: 'PENDING' as const,
        })),
      );

      // Log success
      await query(
        `INSERT INTO integration_logs (restaurant_id, source, status, payload, external_id, order_id)
         VALUES ($1, 'WHATSAPP', 'PROCESSED', $2, $3, $4)`,
        [
          restaurantId,
          JSON.stringify({ phoneNumber, customerName, items: parsedItems }),
          phoneNumber,
          order.id,
        ],
      );

      // Build confirmation message
      const itemLines = parsedItems
        .map((i) => `  • ${i.quantity}x ${i.name} — ₹${(i.unit_price * i.quantity).toFixed(0)}`)
        .join('\n');

      return {
        reply: (
          `✅ *Order Confirmed!*\n\n` +
          `*Order #:* ${order.order_number}\n` +
          `*Items:*\n${itemLines}\n` +
          `*Total:* ₹${totalAmount.toFixed(0)}\n\n` +
          `⏱ Estimated time: 20–30 mins\n` +
          `Your order is being prepared. Thank you! 🙏`
        ),
        orderId: order.id,
        totalAmount,
      };
    } catch (error) {
      await query(
        `INSERT INTO integration_logs (restaurant_id, source, status, error_message, external_id)
         VALUES ($1, 'WHATSAPP', 'FAILED', $2, $3)`,
        [restaurantId, (error as Error).message, phoneNumber],
      );
      return {
        reply: '❌ Sorry, there was an issue placing your order. Please try again or call us.',
        orderId: null,
        totalAmount: 0,
      };
    }
  }

  /**
   * Get WhatsApp integration sync status.
   */
  async getSyncStatus(
    restaurantId: string,
  ): Promise<{ messages_processed: number; orders_placed: number }> {
    const result = await query(
      `SELECT
         COUNT(*) as messages_processed,
         COUNT(*) FILTER (WHERE status = 'PROCESSED') as orders_placed
       FROM integration_logs
       WHERE restaurant_id = $1 AND source = 'WHATSAPP'`,
      [restaurantId],
    );
    const row = result.rows[0];
    return {
      messages_processed: parseInt(row.messages_processed, 10) || 0,
      orders_placed: parseInt(row.orders_placed, 10) || 0,
    };
  }
}

export const whatsappService = new WhatsAppService();
