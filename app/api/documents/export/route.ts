/**
 * Documents Export API
 * POST /api/documents/export - Export documents as ZIP
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lookupEntities } from '@/lib/documents/entityLookup';
import { getStorageProvider } from '@/lib/documents/storage';
import JSZip from 'jszip';

export type ExportStructure = 'financial-year-first' | 'entity-first' | 'category-first';

interface ExportRequest {
  // Filter options
  path?: string; // Current folder path to export from
  documentIds?: string[]; // Specific documents to export

  // Structure options
  structure: ExportStructure;

  // Include sub-items
  includeSubFolders?: boolean;
}

// Sanitize filename for ZIP (remove invalid characters)
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200); // Limit length
}

// Get Australian Financial Year string
function getAustralianFY(date: Date): string {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
}

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  CONTRACT: 'Contracts',
  STATEMENT: 'Statements',
  RECEIPT: 'Receipts',
  TAX: 'Tax_Documents',
  PDS: 'Product_Disclosures',
  VALUATION: 'Valuations',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Leases',
  INVOICE: 'Invoices',
  OTHER: 'Other',
};

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;
    const body: ExportRequest = await request.json();
    const { path, documentIds, structure = 'financial-year-first' } = body;

    console.log('[Documents Export] Starting export:', { path, documentIds, structure });

    // Build query based on path or documentIds
    let whereClause: Record<string, unknown> = { userId, deletedAt: null };

    if (documentIds && documentIds.length > 0) {
      whereClause.id = { in: documentIds };
    } else if (path && path !== '/') {
      // Parse path to determine filter
      const pathParts = path.split('/').filter(Boolean);

      if (pathParts[0] === 'categories' && pathParts[1]) {
        whereClause.category = pathParts[1];
      } else if (pathParts[0] === 'fiscal-year' && pathParts[1]) {
        const targetFY = parseInt(pathParts[1]);
        const startDate = new Date(targetFY, 6, 1); // July 1
        const endDate = new Date(targetFY + 1, 5, 30, 23, 59, 59); // June 30
        whereClause.uploadedAt = { gte: startDate, lte: endDate };
      } else if (pathParts[0] === 'entities' && pathParts[1]) {
        const entityType = pathParts[1];
        const entityId = pathParts[2];

        if (entityId) {
          whereClause.links = { some: { entityType, entityId } };
        } else {
          whereClause.links = { some: { entityType } };
        }
      }
    }

    // Fetch documents
    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        links: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents to export' }, { status: 400 });
    }

    console.log(`[Documents Export] Found ${documents.length} documents`);

    // Collect all entity links for lookup
    const allLinks: { entityType: string; entityId: string }[] = [];
    documents.forEach(doc => {
      doc.links.forEach(link => {
        allLinks.push({ entityType: link.entityType, entityId: link.entityId });
      });
    });

    const entityInfo = allLinks.length > 0
      ? await lookupEntities(userId, allLinks)
      : {};

    // Create ZIP
    const zip = new JSZip();
    const storage = await getStorageProvider(userId);

    // Track files added to avoid duplicates
    const addedPaths = new Set<string>();

    for (const doc of documents) {
      try {
        // Get file content
        let fileContent: Buffer | null = null;

        if (doc.fileContent) {
          // File stored in database
          fileContent = doc.fileContent;
        } else if (doc.storagePath) {
          // File in cloud storage - download it
          const downloadResult = await storage.download(doc.storagePath);
          if (downloadResult.success && downloadResult.data) {
            fileContent = downloadResult.data;
          }
        }

        if (!fileContent) {
          console.warn(`[Documents Export] Could not get content for document: ${doc.id}`);
          continue;
        }

        // Determine folder path based on structure
        const folderPath = generateExportPath(doc, entityInfo, structure);

        // Ensure unique filename
        let filename = doc.originalFilename;
        let fullPath = `${folderPath}/${filename}`;
        let counter = 1;

        while (addedPaths.has(fullPath)) {
          const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
          const baseName = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;
          filename = `${baseName}_${counter}${ext}`;
          fullPath = `${folderPath}/${filename}`;
          counter++;
        }

        addedPaths.add(fullPath);
        zip.file(fullPath, fileContent);

      } catch (err) {
        console.error(`[Documents Export] Error processing document ${doc.id}:`, err);
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    console.log(`[Documents Export] ZIP created, size: ${zipBuffer.length} bytes`);

    // Generate filename based on export path
    let zipFilename = 'Monitrax_Documents';
    if (path && path !== '/') {
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        zipFilename = sanitizeFilename(pathParts.join('_'));
      }
    }
    zipFilename += `_${new Date().toISOString().split('T')[0]}.zip`;

    // Return ZIP file using native Response with Blob
    const blob = new Blob([zipBuffer], { type: 'application/zip' });
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Documents export error:', error);
    return NextResponse.json(
      { error: 'Failed to export documents' },
      { status: 500 }
    );
  }
}

/**
 * Generate export path based on selected structure
 */
function generateExportPath(
  doc: {
    category: string;
    uploadedAt: Date;
    links: { entityType: string; entityId: string }[];
  },
  entityInfo: Record<string, { id: string; name: string; type: string; parentId?: string; parentName?: string; parentType?: string }>,
  structure: ExportStructure
): string {
  const fy = getAustralianFY(doc.uploadedAt);
  const category = CATEGORY_NAMES[doc.category] || doc.category;

  // Find primary entity (prefer property, then others)
  let primaryEntity: { name: string; type: string } | null = null;
  let parentEntity: { name: string; type: string } | null = null;

  // Check for property link first
  const propertyLink = doc.links.find(l => l.entityType === 'PROPERTY');
  if (propertyLink && entityInfo[propertyLink.entityId]) {
    primaryEntity = {
      name: sanitizeFilename(entityInfo[propertyLink.entityId].name),
      type: 'Properties',
    };
  }

  // If no property, check other entities
  if (!primaryEntity) {
    for (const link of doc.links) {
      const info = entityInfo[link.entityId];
      if (info) {
        primaryEntity = {
          name: sanitizeFilename(info.name),
          type: getEntityTypeFolderName(link.entityType),
        };

        // Check if this entity has a parent (e.g., expense linked to property)
        if (info.parentId && info.parentName) {
          parentEntity = {
            name: sanitizeFilename(info.parentName),
            type: getEntityTypeFolderName(info.parentType || 'PROPERTY'),
          };
        }
        break;
      }
    }
  }

  // Build path based on structure
  const pathParts: string[] = [];

  switch (structure) {
    case 'financial-year-first':
      pathParts.push(fy);
      if (parentEntity) {
        pathParts.push(parentEntity.type, parentEntity.name);
      } else if (primaryEntity) {
        pathParts.push(primaryEntity.type, primaryEntity.name);
      }
      pathParts.push(category);
      break;

    case 'entity-first':
      if (parentEntity) {
        pathParts.push(parentEntity.type, parentEntity.name);
        if (primaryEntity) {
          pathParts.push(primaryEntity.type, primaryEntity.name);
        }
      } else if (primaryEntity) {
        pathParts.push(primaryEntity.type, primaryEntity.name);
      } else {
        pathParts.push('General');
      }
      pathParts.push(fy, category);
      break;

    case 'category-first':
      pathParts.push(category);
      pathParts.push(fy);
      if (parentEntity) {
        pathParts.push(parentEntity.type, parentEntity.name);
      } else if (primaryEntity) {
        pathParts.push(primaryEntity.type, primaryEntity.name);
      }
      break;

    default:
      pathParts.push(fy, category);
  }

  return pathParts.join('/');
}

function getEntityTypeFolderName(entityType: string): string {
  const mapping: Record<string, string> = {
    PROPERTY: 'Properties',
    LOAN: 'Loans',
    EXPENSE: 'Expenses',
    INCOME: 'Income',
    ACCOUNT: 'Bank_Accounts',
    INVESTMENT_ACCOUNT: 'Investment_Accounts',
    INVESTMENT_HOLDING: 'Holdings',
    TRANSACTION: 'Transactions',
  };
  return mapping[entityType] || entityType;
}
