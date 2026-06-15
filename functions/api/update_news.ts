// Cloudflare Pages Function to fetch and update news
// Route: /api/update_news

const KEYWORDS = ["kasus", "dbd", "demam berdarah", "banjir", "wabah", "nyamuk", "aedes", "fogging"];

// 14 Districts of West Kalimantan for location matching
const DISTRICTS = [
    "bengkayang",
    "kapuas hulu",
    "kayong utara",
    "ketapang",
    "kubu raya",
    "landak",
    "melawi",
    "mempawah",
    "sambas",
    "sanggau",
    "sekadau",
    "sintang",
    "pontianak",
    "singkawang"
];

// Helper to extract text between XML tags
function extractTags(xml: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
        // Remove CDATA if present
        let content = match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
        matches.push(content);
    }
    return matches;
}

export async function onRequest(context: any) {
    const { env, request } = context;
    
    // Simple protection so only we/cron can trigger this
    const url = new URL(request.url);
    if (url.searchParams.get("secret") !== env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        // Query Google News for Dengue in West Kalimantan from the past 1 day
        const rssUrl = `https://news.google.com/rss/search?q=demam+berdarah+kalimantan+barat+when:1d&hl=id&gl=ID&ceid=ID:id`;
        
        const response = await fetch(rssUrl);
        const xmlText = await response.text();
        
        // Parse the XML
        const items = xmlText.split('<item>').slice(1); // skip the channel header
        
        const districtCounts: Record<string, { dbd_mentions: number, flood_mentions: number }> = {};
        
        // Initialize counts
        for (const d of DISTRICTS) {
            districtCounts[d] = { dbd_mentions: 0, flood_mentions: 0 };
        }

        const now = new Date();

        for (const item of items) {
            const titleMatch = extractTags(item, "title")[0] || "";
            const descMatch = extractTags(item, "description")[0] || "";
            const pubDateMatch = extractTags(item, "pubDate")[0] || "";
            
            const fullText = (titleMatch + " " + descMatch).toLowerCase();
            
            // 1. Time Check: Ensure it's new (published within last 24-48 hours)
            const pubDate = new Date(pubDateMatch);
            const timeDiffHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
            
            if (timeDiffHours > 48) {
                continue; // Skip old news just in case the query returned old stuff
            }

            // 2. Keyword Check: Ensure it contains trigger keywords
            const containsKeyword = KEYWORDS.some(kw => fullText.includes(kw));
            if (!containsKeyword) continue;
            
            const isFlood = fullText.includes("banjir");
            const isDBD = fullText.includes("dbd") || fullText.includes("demam berdarah");

            // 3. Location Matching
            for (const district of DISTRICTS) {
                if (fullText.includes(district)) {
                    if (isDBD) districtCounts[district].dbd_mentions += 1;
                    if (isFlood) districtCounts[district].flood_mentions += 1;
                }
            }
        }

        // 4. Store in D1 Database
        const today = now.toISOString().split('T')[0];
        
        // Prepare batch insert
        const statements = [];
        for (const district of DISTRICTS) {
            const stats = districtCounts[district];
            if (stats.dbd_mentions > 0 || stats.flood_mentions > 0) {
                // Determine district_id for DB based on name
                const isKota = district === "pontianak" || district === "singkawang";
                const dbId = `${isKota ? 'kota' : 'kabupaten'}-${district.replace(" ", "-")}`;
                
                statements.push(
                    env.DB.prepare(`
                        INSERT INTO news_stats (district_id, date, dengue_mentions, flood_mentions)
                        VALUES (?, ?, ?, ?)
                    `).bind(dbId, today, stats.dbd_mentions, stats.flood_mentions)
                );
            }
        }

        if (statements.length > 0) {
            await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Processed news. Inserted ${statements.length} district records for ${today}.`,
            data: districtCounts
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
