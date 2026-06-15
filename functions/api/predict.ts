export async function onRequest(context: any) {
    const { env, request } = context;
    const url = new URL(request.url);
    const districtId = url.searchParams.get("district");

    if (!districtId) {
        return new Response(JSON.stringify({ error: "Missing 'district' query parameter" }), { status: 400 });
    }

    try {
        // 1. Fetch District Info from D1
        const districtRow = await env.DB.prepare(`SELECT * FROM districts WHERE id = ?`).bind(districtId).first();
        if (!districtRow) {
            return new Response(JSON.stringify({ error: "District not found in database" }), { status: 404 });
        }

        // 2. Fetch Latest News Stats from D1
        const today = new Date().toISOString().split('T')[0];
        const newsRow = await env.DB.prepare(`
            SELECT * FROM news_stats 
            WHERE district_id = ? AND date = ? 
            ORDER BY id DESC LIMIT 1
        `).bind(districtId, today).first();

        const dengueMentions = newsRow ? newsRow.dengue_mentions : 0;
        let newsFeature = 'Low';
        if (dengueMentions > 5) newsFeature = 'High';
        else if (dengueMentions > 1) newsFeature = 'Medium';

        // 3. Fetch BMKG Weather Data
        let rainfallFeature = 'Low'; // Default
        if (districtRow.bmkg_code && districtRow.bmkg_code !== 'unknown') {
            try {
                // Fetch from BMKG
                const bmkgRes = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${districtRow.bmkg_code}`);
                if (bmkgRes.ok) {
                    const bmkgData = await bmkgRes.json();
                    // VERY basic parsing for rainfall (assuming Cuaca array exists)
                    // Hujan Lebat = High, Hujan Ringan = Medium, Cerah = Low
                    const cuaca = JSON.stringify(bmkgData).toLowerCase();
                    if (cuaca.includes("hujan lebat") || cuaca.includes("hujan petir")) rainfallFeature = 'High';
                    else if (cuaca.includes("hujan")) rainfallFeature = 'Medium';
                }
            } catch (e) {
                console.warn("BMKG API error", e);
            }
        }

        // 4. Load Naive Bayes Model Weights
        // We use env.ASSETS to securely fetch static files deployed with our Pages app
        const assetUrl = new URL("/data/model_weights.json", request.url);
        const weightsRes = await env.ASSETS.fetch(assetUrl);
        if (!weightsRes.ok) {
            return new Response(JSON.stringify({ error: "Model weights not found. Ensure train.py has run." }), { status: 500 });
        }
        const weights = await weightsRes.json();

        // 5. Naive Bayes Inference Calculation
        const classes = weights.classes;
        const classPrior = weights.class_prior;
        const features = weights.features;

        let maxProb = -Infinity;
        let predictedClass = 'Low';
        const scores: Record<string, number> = {};

        // Calculate Log Probability for each class: log(P(Class)) + log(P(Feature1|Class)) + log(P(Feature2|Class))
        for (const cls of classes) {
            let logProb = Math.log(classPrior[cls]);
            
            // Add Rainfall feature probability
            const pRain = features.rainfall[cls][rainfallFeature] || 1e-6; // prevent log(0)
            logProb += Math.log(pRain);

            // Add News feature probability
            const pNews = features.news_mentions[cls][newsFeature] || 1e-6;
            logProb += Math.log(pNews);

            scores[cls] = logProb;
            if (logProb > maxProb) {
                maxProb = logProb;
                predictedClass = cls;
            }
        }

        // Convert log probabilities to relative percentages for UI presentation
        const expScores = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.exp(v)]));
        const totalExp = Object.values(expScores).reduce((a, b) => a + b, 0);
        const percentages = Object.fromEntries(Object.entries(expScores).map(([k, v]) => [k, Math.round((v / totalExp) * 100)]));

        // 6. Return the Prediction to the Frontend
        return new Response(JSON.stringify({
            success: true,
            district: districtRow.name,
            inputs: {
                rainfall: rainfallFeature,
                news: newsFeature
            },
            prediction: {
                risk_level: predictedClass,
                confidence: percentages[predictedClass],
                all_probabilities: percentages
            }
        }), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Allow frontend to fetch this
            }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
