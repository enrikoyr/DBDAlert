export default {
  async scheduled(event, env, ctx) {
    // Replace this with your actual deployed Cloudflare Pages URL
    const baseUrl = env.PAGES_URL || "https://dbd-alert.pages.dev";
    
    // The endpoint expects the secret key to prevent unauthorized access
    const targetUrl = `${baseUrl}/api/update_news?secret=${env.CRON_SECRET}`;
    
    console.log(`Cron triggered! Fetching: ${targetUrl}`);
    
    try {
      const response = await fetch(targetUrl);
      const text = await response.text();
      console.log(`Response Status: ${response.status}`);
      console.log("Response Body:", text);
    } catch (error) {
      console.error("Error fetching news:", error);
    }
  }
};
