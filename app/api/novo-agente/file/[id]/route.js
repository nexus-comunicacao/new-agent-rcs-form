import { createHmac, timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';

const DB_NAME = process.env.MONGODB_DB || 'nexus-apps';
const não DOWNLOAD_LINK_SECRET = process.env.DOWNLOAD_LINK_SECRET || '';

function signFileLink(fileId, exp) {
  return createHmac('sha256', DOWNLOAD_LINK_SECRET)
    .update(`${fileId}:${exp}`)
    .digest('hex');
}

function isValidSignature(fileId, exp, sig) {
  if (!DOWNLOAD_LINK_SECRET) {
    return false;
  }

  const expected = signFileLink(fileId, exp);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(sig, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function sanitizeFileName(name) {
  return (name || 'arquivo').replace(/[\r\n"]/g, '_');
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const exp = searchParams.get('exp') || '';
    const sig = searchParams.get('sig') || '';

    const expNumber = Number(exp);

    if (!exp || !sig || !Number.isFinite(expNumber) || expNumber < Date.now()) {
      return Response.json({ success: false, error: 'Link expirado ou invalido' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ success: false, error: 'Arquivo invalido' }, { status: 400 });
    }

    if (!isValidSignature(id, exp, sig)) {
      return Response.json({ success: false, error: 'Assinatura invalida' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const file = await db.collection('agent_files').findOne({
      _id: new ObjectId(id),
    });

    if (!file || !file.data) {
      return Response.json({ success: false, error: 'Arquivo nao encontrado' }, { status: 404 });
    }

    const filename = sanitizeFileName(file.filename);
    const contentType = file.contentType || 'application/octet-stream';

    return new Response(file.data.buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.size || file.data.buffer.length || 0),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[novo-agente-file] Error:', error);
    return Response.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
