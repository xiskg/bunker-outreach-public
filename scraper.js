import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// List of file extensions to ignore during regex matching
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.webp', '.css', '.js', '.woff', '.woff2', '.ttf'];

// Clean up and filter out fake emails (like image filenames matching regex)
function cleanEmails(emails) {
  return emails
    .map(email => email.trim().toLowerCase())
    .filter(email => {
      // Must contain a dot in domain part
      if (!email.includes('.')) return false;

      // Filter out ignored file extensions
      const hasIgnoredExtension = IGNORED_EXTENSIONS.some(ext => email.endsWith(ext));
      if (hasIgnoredExtension) return false;

      // Validate length and characters
      const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
      return regex.test(email);
    });
}

// Extract emails from HTML content (both text and mailto links)
function extractEmailsFromHtml(html) {
  const emails = new Set();
  const $ = cheerio.load(html);

  // 1. Scan mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (email) emails.add(email);
    }
  });

  // 2. Scan entire page text via regex
  const text = $('body').text();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/gi;
  const matches = text.match(emailRegex);
  if (matches) {
    matches.forEach(m => emails.add(m));
  }

  // 3. Scan attributes (like placeholder or title)
  const htmlStr = $.html();
  const matchesHtml = htmlStr.match(emailRegex);
  if (matchesHtml) {
    matchesHtml.forEach(m => emails.add(m));
  }

  return cleanEmails(Array.from(emails));
}

// Normalize URL to start with http/https
function normalizeUrl(urlStr) {
  let cleanUrl = urlStr.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }
  return cleanUrl;
}

// Find potential contact/about links on the page
function findSubpageLinks(html, baseUrlStr) {
  const $ = cheerio.load(html);
  const links = new Set();
  const baseUrl = new URL(baseUrlStr);

  const keywords = [
    'contact', 'about', 'team', 'careers', 'privacy', 'legal', 'terms', 'help', 'info',
    'contato', 'sobre', 'equipe', 'vagas', 'ajuda', 'fale-conosco', 'quem-somos', 'politica'
  ];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href').trim();
    const text = $(el).text().toLowerCase().trim();

    // Check if the link href or text contains contact keywords
    const matchesKeyword = keywords.some(keyword => {
      return href.toLowerCase().includes(keyword) || text.includes(keyword);
    });

    if (matchesKeyword) {
      try {
        const resolvedUrl = new URL(href, baseUrlStr);
        // Only crawl links from the same domain
        if (resolvedUrl.hostname === baseUrl.hostname) {
          links.add(resolvedUrl.toString());
        }
      } catch (err) {
        // Ignore invalid urls
      }
    }
  });

  // Limit to max 5 subpages to keep it extremely fast
  return Array.from(links).slice(0, 5);
}

// Main crawl function
export async function scrapeWebsiteForEmail(urlStr) {
  const cleanUrl = normalizeUrl(urlStr);
  console.log(`[Scraper] Scraping home page: ${cleanUrl}`);

  try {
    const response = await axios.get(cleanUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      validateStatus: () => true // Prevent throw on 404/500
    });

    if (response.status >= 400) {
      console.log(`[Scraper] Home page returned status ${response.status}. Trying HTTP instead of HTTPS if applicable...`);
    }

    const html = response.data;
    if (typeof html !== 'string') {
      return null;
    }

    // 1. Try to find email on home page
    let foundEmails = extractEmailsFromHtml(html);
    if (foundEmails.length > 0) {
      console.log(`[Scraper] Found email(s) on home page: ${foundEmails.join(', ')}`);
      return foundEmails[0]; // Return the first one
    }

    // 2. If no email, scan for contact subpages
    console.log(`[Scraper] No emails found on home page. Looking for contact subpage links...`);
    const subpages = findSubpageLinks(html, cleanUrl);
    console.log(`[Scraper] Found ${subpages.length} potential subpages to crawl.`);

    for (const subpage of subpages) {
      console.log(`[Scraper] Scraping subpage: ${subpage}`);
      try {
        const subResponse = await axios.get(subpage, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 8000,
          validateStatus: () => true
        });

        const subHtml = subResponse.data;
        if (typeof subHtml === 'string') {
          const subpageEmails = extractEmailsFromHtml(subHtml);
          if (subpageEmails.length > 0) {
            console.log(`[Scraper] Found email(s) on subpage ${subpage}: ${subpageEmails.join(', ')}`);
            return subpageEmails[0];
          }
        }
      } catch (subErr) {
        console.log(`[Scraper] Error scraping subpage ${subpage}: ${subErr.message}`);
      }
    }

    console.log(`[Scraper] Finished crawling. No emails found for ${urlStr}`);
    return null;
  } catch (error) {
    console.log(`[Scraper] Error scraping main site ${cleanUrl}: ${error.message}`);
    return null;
  }
}
