import * as XLSX from 'xlsx';
import { prisma } from '../prisma.js';

export interface RawLeadRow {
  'Business Name'?: string;
  'business_name'?: string;
  'Business'?: string;
  'Name'?: string;

  'Category'?: string;
  'category'?: string;

  'Contact Name'?: string;
  'Contact Person'?: string;
  'contact_name'?: string;

  'Phone Number'?: string;
  'Phone'?: string;
  'phone'?: string;
  'Mobile'?: string;

  'Email Address'?: string;
  'Email'?: string;
  'email'?: string;

  'Website Status'?: string;
  'website_status'?: string;

  'Website URL'?: string;
  'Website'?: string;
  'website'?: string;

  'Rating'?: number | string;
  'rating'?: number | string;

  'Total Reviews'?: number | string;
  'Reviews'?: number | string;
  'total_reviews'?: number | string;

  'Locality/Address'?: string;
  'Address'?: string;
  'address'?: string;
  'Locality'?: string;

  'Google Maps URL'?: string;
  'Maps URL'?: string;
  'google_maps_url'?: string;

  'Lead Score'?: number | string;
  'Score'?: number | string;
  'lead_score'?: number | string;

  'CRM Status'?: string;
  'Status'?: string;
  'crm_status'?: string;

  'Notes'?: string;
  'notes'?: string;

  [key: string]: any;
}

export interface NormalizedLead {
  businessName: string;
  category?: string;
  industry?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  websiteStatus?: string;
  websiteUrl?: string;
  rating?: number;
  totalReviews?: number;
  address?: string;
  googleMapsUrl?: string;
  leadScore?: number;
  crmStatus: string;
  notes?: string;
  rawRowIndex: number;
  sourceFile?: string;
}

export interface DuplicateMatch {
  incoming: NormalizedLead;
  existingId: string;
  existingBusinessName: string;
  existingPhone?: string | null;
  existingEmail?: string | null;
  existingMapsUrl?: string | null;
  matchedBy: 'phone' | 'email' | 'businessName' | 'googleMapsUrl' | 'websiteUrl';
}

export class LeadParserService {
  /**
   * Normalizes a phone number for comparison (strips non-digits, leading zeros, +91 etc.)
   */
  static normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      return digits.slice(2);
    }
    return digits;
  }

  /**
   * Parses buffer of XLSX or CSV file with intelligent column auto-detection
   */
  static parseFileBuffer(buffer: Buffer, fileName: string): { rows: NormalizedLead[]; errors: { row: number; reason: string }[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: [{ row: 0, reason: 'Empty spreadsheet / no worksheets found' }] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) {
      return { rows: [], errors: [{ row: 0, reason: 'Empty spreadsheet' }] };
    }

    // 1. Find the header row (locate row containing multiple known lead headers)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const row = rawMatrix[i];
      if (Array.isArray(row)) {
        const rowStr = row.map(c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
        const matchedKeywords = [
          'businessname', 'company', 'name', 'phone', 'email', 'leadscore',
          'rating', 'reviews', 'address', 'locality', 'category', 'status', 'maps', 'website'
        ].filter(k => rowStr.includes(k));

        const textCols = row.filter(c => typeof c === 'string' && c.trim().length > 0);
        if (matchedKeywords.length >= 2 || (textCols.length >= 4 && matchedKeywords.length >= 1)) {
          headerRowIdx = i;
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const rawHeaders: string[] = (rawMatrix[headerRowIdx] || []).map(h => String(h || '').trim());
    const dataRows = rawMatrix.slice(headerRowIdx + 1);

    // Extract report title/industry metadata from top banner rows or sheet name
    let reportIndustry = '';
    for (let r = 0; r <= headerRowIdx; r++) {
      const topRowStr = (rawMatrix[r] || []).map(c => String(c || '')).join(' ');
      const match = topRowStr.match(/\((.*?)\s+leads?\)/i) || topRowStr.match(/Report\s*\((.*?)\)/i);
      if (match && match[1]) {
        const rawInd = match[1].trim();
        // Capitalize words nicely (e.g. "martial arts" -> "Martial Arts", "dental clinic" -> "Dental Clinic")
        reportIndustry = rawInd
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        break;
      }
    }

    const rows: NormalizedLead[] = [];
    const errors: { row: number; reason: string }[] = [];

    // Helper to sanitize key for matching
    const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Common placeholder strings in lead exports to treat as null/empty
    const isPlaceholder = (val?: string): boolean => {
      if (!val) return true;
      const lower = val.toLowerCase().trim();
      return (
        lower === 'none listed' ||
        lower === 'not listed' ||
        lower === 'none' ||
        lower === 'no website' ||
        lower === 'n/a' ||
        lower === 'na' ||
        lower === 'null' ||
        lower === 'undefined' ||
        lower === '-' ||
        lower === '--' ||
        lower === 'view on maps 📍' ||
        lower === 'view on maps'
      );
    };

    dataRows.forEach((rowArray, idx) => {
      const absoluteRowIdx = headerRowIdx + 1 + idx; // 0-indexed in sheet
      const rowNum = absoluteRowIdx + 1; // 1-based row number for display

      // If row is completely empty, skip silently
      if (!rowArray || rowArray.every(cell => cell === '' || cell === null || cell === undefined)) {
        return;
      }

      // Build key-value map and hyperlink map for this row
      const rowMap: Record<string, any> = {};
      const linkMap: Record<string, string> = {};

      rawHeaders.forEach((header, colIdx) => {
        if (header) {
          const val = rowArray[colIdx];
          const cleanedH = clean(header);
          if (val !== undefined && val !== null && val !== '') {
            rowMap[cleanedH] = val;
            rowMap[header] = val;
          }

          // Extract Excel hyperlink if present on this cell
          try {
            const cellRef = XLSX.utils.encode_cell({ r: absoluteRowIdx, c: colIdx });
            const cellObj = sheet[cellRef];
            const hyperlink = cellObj?.l?.Target || cellObj?.l?.Rel?.Target;
            if (hyperlink) {
              linkMap[cleanedH] = hyperlink;
              linkMap[header] = hyperlink;
            }
          } catch (e) {
            // Ignore cell ref error
          }
        }
      });

      const getVal = (candidates: string[], excludeKeywords: string[] = []): string | undefined => {
        for (const cand of candidates) {
          const c = clean(cand);
          if (rowMap[c] !== undefined && rowMap[c] !== '') {
            const strVal = String(rowMap[c]).trim();
            if (!isPlaceholder(strVal)) return strVal;
          }
        }
        for (const cand of candidates) {
          const c = clean(cand);
          for (const key of Object.keys(rowMap)) {
            if (excludeKeywords.some(ex => key.includes(ex))) continue;
            if (key.includes(c) && rowMap[key] !== undefined && rowMap[key] !== '') {
              const strVal = String(rowMap[key]).trim();
              if (!isPlaceholder(strVal)) return strVal;
            }
          }
        }
        return undefined;
      };

      const getLink = (candidates: string[], excludeKeywords: string[] = []): string | undefined => {
        for (const cand of candidates) {
          const c = clean(cand);
          if (linkMap[c]) return linkMap[c];
        }
        for (const cand of candidates) {
          const c = clean(cand);
          for (const key of Object.keys(linkMap)) {
            if (excludeKeywords.some(ex => key.includes(ex))) continue;
            if (key.includes(c) && linkMap[key]) return linkMap[key];
          }
        }
        return undefined;
      };

      // 1. Business Name (flexible search)
      let businessName = getVal([
        'businessname', 'companyname', 'business', 'company', 'name', 'title',
        'storename', 'clientname', 'accountname', 'organization', 'firmname', 'firm',
        'hotelname', 'restaurantname', 'hospitalname', 'clinicname', 'leadname',
        'prospect', 'lead', 'entityname', 'entity', 'placename', 'placedetails'
      ]);

      // If business name wasn't found by standard keys, take first non-empty column in row
      if (!businessName) {
        const firstCol = rowArray.find(c => c && typeof c === 'string' && c.trim().length > 1 && !isPlaceholder(String(c)));
        if (firstCol) businessName = String(firstCol).trim();
      }

      if (!businessName) {
        errors.push({ row: rowNum, reason: 'Missing Business Name / Row unreadable' });
        return;
      }

      // 2. Phone
      const phone = getVal([
        'phonenumber', 'phone', 'mobile', 'mobilenumber', 'contactnumber',
        'tel', 'telephone', 'cell', 'whatsapp', 'ph'
      ]);

      // 3. Email
      const email = getVal([
        'emailaddress', 'email', 'mail', 'contactemail', 'e-mail'
      ]);

      // 4. Contact Name
      const contactName = getVal([
        'contactname', 'contactperson', 'contact', 'person', 'owner',
        'decisionmaker', 'fullname', 'representative', 'manager', 'leadcontact'
      ]);

      // 5. Category & Industry
      const category = getVal([
        'category', 'subcategory', 'businesstype', 'type', 'niche',
        'speciality', 'specialization', 'profession'
      ]);

      let industry = getVal(['industry', 'sector', 'businesssector', 'vertical']);
      if (!industry && reportIndustry) {
        industry = reportIndustry;
      }
      if (!industry && category) {
        industry = category;
      }

      // 6. Website URL (check hyperlink first, then text) - exclude maps
      const websiteUrl =
        getLink(['websiteurllink', 'websiteurl', 'website', 'siteurl', 'site', 'weburl', 'domain'], ['map', 'gmap']) ||
        getVal(['websiteurllink', 'websiteurl', 'website', 'siteurl', 'site', 'weburl', 'domain'], ['map', 'gmap']);

      // 7. Website Status
      const websiteStatus = getVal([
        'websitestatus', 'haswebsite', 'siteavailable', 'webstatus'
      ]);

      // 8. Address / Locality
      const address = getVal([
        'localityaddress', 'address', 'locality', 'location', 'city',
        'area', 'state', 'street', 'pincode', 'zip'
      ]);

      // 9. Google Maps URL (check hyperlink first, then text)
      const googleMapsUrl =
        getLink(['googlemapsurl', 'googlemaps', 'mapsurl', 'maps', 'gmap', 'gmaps', 'maplink', 'locationurl']) ||
        getVal(['googlemapsurl', 'googlemaps', 'mapsurl', 'maps', 'gmap', 'gmaps', 'maplink', 'locationurl']);

      // 10. Notes
      const notes = getVal([
        'notes', 'note', 'comments', 'comment', 'remarks', 'remark', 'description'
      ]);

      // 11. Rating
      const ratingRaw = getVal(['rating', 'stars', 'score', 'googlerating', 'avgrating']);
      const rating = ratingRaw !== undefined && !isNaN(Number(ratingRaw)) ? Number(ratingRaw) : undefined;

      // 12. Total Reviews
      const reviewsRaw = getVal(['totalreviews', 'reviews', 'reviewcount', 'numreviews', 'googlereviews']);
      const totalReviews = reviewsRaw !== undefined && !isNaN(Number(reviewsRaw)) ? parseInt(String(reviewsRaw), 10) : undefined;

      // 13. Lead Score (Parse "🔥 HOT", "⚡ WARM", "❄️ COLD", or numbers)
      let leadScore = 50;
      const scoreRaw = getVal(['leadscore', 'score', 'priorityscore', 'leadquality']);
      if (scoreRaw) {
        const scoreUpper = scoreRaw.toUpperCase();
        if (scoreUpper.includes('HOT') || scoreUpper.includes('🔥')) {
          leadScore = 90;
        } else if (scoreUpper.includes('WARM') || scoreUpper.includes('⚡')) {
          leadScore = 70;
        } else if (scoreUpper.includes('COLD') || scoreUpper.includes('❄️')) {
          leadScore = 30;
        } else if (!isNaN(Number(scoreRaw))) {
          leadScore = parseInt(scoreRaw, 10);
        }
      }

      // 14. CRM Status (Strip "CRMStatus." prefix if present)
      let rawStatus = getVal(['crmstatus', 'status', 'stage', 'leadstatus', 'pipelinestage']) || 'NEW';
      rawStatus = rawStatus.replace(/^crmstatus\./i, '').toUpperCase().trim();
      if (rawStatus === 'QUALIFIED') rawStatus = 'DEMO_DISCOVERY';
      if (rawStatus === 'PROPOSAL') rawStatus = 'NEGOTIATION';
      const validStatuses = ['NEW', 'CONTACTED', 'DEMO_DISCOVERY', 'ENGAGED', 'NEGOTIATION', 'WON', 'LOST'];
      const crmStatus = validStatuses.includes(rawStatus) ? rawStatus : 'NEW';

      rows.push({
        businessName,
        category: category || industry || undefined,
        industry: industry || category || undefined,
        contactName,
        phone,
        email,
        websiteStatus,
        websiteUrl,
        rating,
        totalReviews,
        address,
        googleMapsUrl,
        leadScore,
        crmStatus,
        notes,
        rawRowIndex: rowNum,
        sourceFile: fileName,
      });
    });

    return { rows, errors };
  }

  /**
   * Evaluates a batch of normalized leads against the database for duplicates
   */
  static async checkDuplicates(leads: NormalizedLead[]): Promise<{
    unique: NormalizedLead[];
    duplicates: DuplicateMatch[];
  }> {
    const existingLeads = await prisma.lead.findMany({
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        googleMapsUrl: true,
        websiteUrl: true,
      }
    });

    // Build O(1) hash maps for fast deduplication lookup
    const phoneMap = new Map<string, typeof existingLeads[0]>();
    const emailMap = new Map<string, typeof existingLeads[0]>();
    const mapsMap = new Map<string, typeof existingLeads[0]>();
    const nameMap = new Map<string, typeof existingLeads[0]>();

    for (const existing of existingLeads) {
      const p = this.normalizePhone(existing.phone);
      if (p && p.length >= 7 && !phoneMap.has(p)) phoneMap.set(p, existing);

      const e = existing.email ? existing.email.toLowerCase().trim() : '';
      if (e && !emailMap.has(e)) emailMap.set(e, existing);

      const m = existing.googleMapsUrl ? existing.googleMapsUrl.toLowerCase().trim() : '';
      if (m && !mapsMap.has(m)) mapsMap.set(m, existing);

      const n = existing.businessName ? existing.businessName.toLowerCase().trim() : '';
      if (n && !nameMap.has(n)) nameMap.set(n, existing);
    }

    const duplicates: DuplicateMatch[] = [];
    const unique: NormalizedLead[] = [];

    for (const lead of leads) {
      const normPhone = this.normalizePhone(lead.phone);
      const normEmail = lead.email ? lead.email.toLowerCase().trim() : '';
      const normName = lead.businessName ? lead.businessName.toLowerCase().trim() : '';
      const normMaps = lead.googleMapsUrl ? lead.googleMapsUrl.toLowerCase().trim() : '';

      let matchedExisting: typeof existingLeads[0] | undefined = undefined;
      let matchedBy: DuplicateMatch['matchedBy'] = 'businessName';

      if (normPhone && normPhone.length >= 7 && phoneMap.has(normPhone)) {
        matchedExisting = phoneMap.get(normPhone);
        matchedBy = 'phone';
      } else if (normEmail && emailMap.has(normEmail)) {
        matchedExisting = emailMap.get(normEmail);
        matchedBy = 'email';
      } else if (normMaps && mapsMap.has(normMaps)) {
        matchedExisting = mapsMap.get(normMaps);
        matchedBy = 'googleMapsUrl';
      } else if (normName && nameMap.has(normName)) {
        matchedExisting = nameMap.get(normName);
        matchedBy = 'businessName';
      }

      if (matchedExisting) {
        duplicates.push({
          incoming: lead,
          existingId: matchedExisting.id,
          existingBusinessName: matchedExisting.businessName,
          existingPhone: matchedExisting.phone,
          existingEmail: matchedExisting.email,
          existingMapsUrl: matchedExisting.googleMapsUrl,
          matchedBy,
        });
      } else {
        unique.push(lead);
      }
    }

    return { unique, duplicates };
  }
}
