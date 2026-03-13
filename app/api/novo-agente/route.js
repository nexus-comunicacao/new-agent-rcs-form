import { createHmac } from 'crypto';
import { Binary } from 'mongodb';
import clientPromise from '../../../lib/mongodb';
import emailjs from '@emailjs/nodejs';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

const DB_NAME = process.env.MONGODB_DB || 'nexus-apps';
const DOWNLOAD_LINK_SECRET = process.env.DOWNLOAD_LINK_SECRET || '';
const DOWNLOAD_LINK_TTL_MS = 120 * 60 * 60 * 1000;

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';

function slugifyName(value) {
  return (value || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'arquivo';
}

function extractExtension(filename, mimeType) {
  const parts = (filename || '').split('.');
  const rawExt = parts.length > 1 ? parts.pop() : '';
  const ext = (rawExt || '').toLowerCase();

  if (ext) {
    return ext;
  }

  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'jpg';
  }

  return 'bin';
}

function buildStoredFileName(displayName, kind, originalName, mimeType) {
  const base = slugifyName(displayName);
  const ext = extractExtension(originalName, mimeType);
  return `${base}-${kind}.${ext}`;
}

function signFileLink(fileId, exp) {
  return createHmac('sha256', DOWNLOAD_LINK_SECRET)
    .update(`${fileId}:${exp}`)
    .digest('hex');
}

function buildSignedFileLink(baseUrl, fileId) {
  if (!DOWNLOAD_LINK_SECRET) {
    return '';
  }

  const exp = Date.now() + DOWNLOAD_LINK_TTL_MS;
  const sig = signFileLink(fileId, exp);
  return `${baseUrl}/api/novo-agente/file/${fileId}?exp=${exp}&sig=${sig}`;
}

function corsHeaders(origin) {
  const allowedOrigin =
    ALLOWED_ORIGINS.includes('*')
      ? '*'
      : ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request) {
  const origin = request.headers.get('origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  const baseUrl = new URL(request.url).origin;

  try {
    const formData = await request.formData();

    const data = {
      nome: formData.get('nome')?.toString().trim() || '',
      descricao: formData.get('descricao')?.toString().trim() || '',
      website: formData.get('website')?.toString().trim() || '',
      telefone: formData.get('telefone')?.toString().trim() || '',
      responsavel: formData.get('responsavel')?.toString().trim() || '',
      cargo: formData.get('cargo')?.toString().trim() || '',
      email: formData.get('email')?.toString().trim() || '',
      segmento: formData.get('segmento')?.toString().trim() || '',
      adicional: formData.get('adicional')?.toString().trim() || '',
      status: 'pending',
      createdAt: new Date(),
    };

    const banner = formData.get('banner');
    const logo = formData.get('logo');

    if (
      !data.nome ||
      !data.descricao ||
      !data.website ||
      !data.telefone ||
      !data.responsavel ||
      !data.cargo ||
      !data.email ||
      !data.segmento ||
      !data.adicional ||
      !banner ||
      !banner.size ||
      !logo ||
      !logo.size
    ) {
      return Response.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400, headers }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const fileRefs = {};

    if (banner && banner.size > 0) {
      const buffer = Buffer.from(await banner.arrayBuffer());
      const storedBannerName = buildStoredFileName(data.nome, 'banner', banner.name, banner.type);
      const fileDoc = await db.collection('agent_files').insertOne({
        filename: storedBannerName,
        contentType: banner.type,
        size: banner.size,
        data: new Binary(buffer),
        uploadedAt: new Date(),
      });
      fileRefs.banner = {
        fileId: fileDoc.insertedId,
        filename: storedBannerName,
        contentType: banner.type,
        size: banner.size,
      };
    }

    if (logo && logo.size > 0) {
      const buffer = Buffer.from(await logo.arrayBuffer());
      const storedLogoName = buildStoredFileName(data.nome, 'logo', logo.name, logo.type);
      const fileDoc = await db.collection('agent_files').insertOne({
        filename: storedLogoName,
        contentType: logo.type,
        size: logo.size,
        data: new Binary(buffer),
        uploadedAt: new Date(),
      });
      fileRefs.logo = {
        fileId: fileDoc.insertedId,
        filename: storedLogoName,
        contentType: logo.type,
        size: logo.size,
      };
    }

    data.files = fileRefs;

    const result = await db.collection('agent_requests').insertOne(data);

    const downloadLinks = {
      banner: fileRefs.banner?.fileId
        ? buildSignedFileLink(baseUrl, fileRefs.banner.fileId.toString())
        : '',
      logo: fileRefs.logo?.fileId
        ? buildSignedFileLink(baseUrl, fileRefs.logo.fileId.toString())
        : '',
    };

    console.log(`[novo-agente] Submission saved: ${result.insertedId}`);

    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            nome: data.nome,
            descricao: data.descricao,
            website: data.website,
            telefone: data.telefone,
            responsavel: `${data.responsavel}${data.cargo ? ` (${data.cargo})` : ''}`,
            email: data.email,
            segmento: data.segmento,
            adicional: data.adicional,
            banner_nome: fileRefs.banner?.filename || 'Nao enviado',
            logo_nome: fileRefs.logo?.filename || 'Nao enviado',
            banner_link: downloadLinks.banner || 'Nao disponivel',
            logo_link: downloadLinks.logo || 'Nao disponivel',
          },
          {
            publicKey: EMAILJS_PUBLIC_KEY,
            privateKey: EMAILJS_PRIVATE_KEY || undefined,
          }
        );
        console.log(`[novo-agente] Email sent for: ${result.insertedId}`);
      } catch (emailError) {
        console.error('[novo-agente] EmailJS error (data saved):', emailError);
      }
    }

    return Response.json(
      {
        success: true,
        id: result.insertedId.toString(),
        downloadLinks,
        message: 'Solicitação recebida com sucesso',
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error('[novo-agente] Error:', error);
    return Response.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500, headers }
    );
  }
}

export async function GET() {
  return Response.json(
    { status: 'ok', endpoint: 'POST /api/novo-agente' },
    { status: 200 }
  );
}
