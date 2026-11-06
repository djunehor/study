import { parse } from 'node-html-parser';

export interface RawFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function unwrapCdata(input: string): string {
  let result = input;
  while (true) {
    const start = result.indexOf('<![CDATA[');
    if (start === -1) break;
    const end = result.indexOf(']]>', start + 9);
    if (end === -1) break;
    result = result.slice(0, start) + result.slice(start + 9, end) + result.slice(end + 3);
  }
  return result;
}

function collapseSpaces(input: string): string {
  let out = '';
  let prevSpace = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const isSpace = ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
    if (isSpace) {
      if (!prevSpace) {
        out += ' ';
        prevSpace = true;
      }
    } else {
      out += ch;
      prevSpace = false;
    }
  }
  return out.trim();
}

/**
 * Clean HTML tags and entities from a text string using node-html-parser.
 */
export function stripHtml(html: string): string {
  const withoutCdata = unwrapCdata(html)
    .replaceAll('<br />', ' ')
    .replaceAll('<br/>', ' ')
    .replaceAll('<br>', ' ');
  const root = parse(withoutCdata);
  const text = root.text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#252;', 'ü')
    .replaceAll('&#228;', 'ä')
    .replaceAll('&#246;', 'ö')
    .replaceAll('&#223;', 'ß')
    .replaceAll('&#214;', 'Ö')
    .replaceAll('&#196;', 'Ä')
    .replaceAll('&#220;', 'Ü')
    .replaceAll('&#187;', '»')
    .replaceAll('&#171;', '«');
  return collapseSpaces(text);
}

/**
 * Extracts content from an XML tag without regular expressions.
 */
function extractTag(xml: string, tagName: string): string {
  const lowerXml = xml.toLowerCase();
  const lowerTag = tagName.toLowerCase();
  const openToken = `<${lowerTag}`;
  const closeToken = `</${lowerTag}>`;

  let searchPos = 0;
  while (searchPos < lowerXml.length) {
    const startIdx = lowerXml.indexOf(openToken, searchPos);
    if (startIdx === -1) return '';
    const nextChar = lowerXml[startIdx + openToken.length];
    if (nextChar === '>' || nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || nextChar === '\r') {
      const tagEndIdx = lowerXml.indexOf('>', startIdx + openToken.length);
      if (tagEndIdx === -1) return '';
      const closeIdx = lowerXml.indexOf(closeToken, tagEndIdx + 1);
      if (closeIdx === -1) return '';
      const inner = xml.slice(tagEndIdx + 1, closeIdx).trim();
      return unwrapCdata(inner).trim();
    }
    searchPos = startIdx + openToken.length;
  }

  return '';
}

/**
 * Parse an RSS feed string into RawFeedItem list without regular expressions.
 */
export function parseRssFeed(xmlText: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];
  const lowerXml = xmlText.toLowerCase();
  let cursor = 0;

  while (cursor < lowerXml.length) {
    const itemStart = lowerXml.indexOf('<item', cursor);
    if (itemStart === -1) break;

    const afterItemChar = lowerXml[itemStart + 5];
    if (afterItemChar !== '>' && afterItemChar !== ' ' && afterItemChar !== '\t' && afterItemChar !== '\n' && afterItemChar !== '\r') {
      cursor = itemStart + 5;
      continue;
    }

    const openTagEnd = lowerXml.indexOf('>', itemStart + 5);
    if (openTagEnd === -1) break;

    const itemEnd = lowerXml.indexOf('</item>', openTagEnd + 1);
    if (itemEnd === -1) break;

    const block = xmlText.slice(openTagEnd + 1, itemEnd);
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    const guid = extractTag(block, 'guid') || link;

    if (title && link) {
      items.push({
        title: stripHtml(title),
        link: stripHtml(link),
        description,
        pubDate: stripHtml(pubDate),
        guid: stripHtml(guid),
      });
    }

    cursor = itemEnd + 7;
  }

  return items;
}

