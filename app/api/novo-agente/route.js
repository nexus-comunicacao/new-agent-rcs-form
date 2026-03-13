import { Binary, ObjectId } from 'mongodb';
import clientPromise from '../../../lib/mongodb';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

const DB_NAME = process.env.MONGODB_DB || 'nexus-apps';

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

    if (!data.nome || !data.email || !data.telefone || !data.responsavel) {
      return Response.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400, headers }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const fileRefs = {};

    const banner = formData.get('banner');
    if (banner && banner.size > 0) {
      const buffer = Buffer.from(await banner.arrayBuffer());
      const fileDoc = await db.collection('agent_files').insertOne({
        filename: banner.name,
        contentType: banner.type,
        size: banner.size,
        data: new Binary(buffer),
        uploadedAt: new Date(),
      });
      fileRefs.banner = {
        fileId: fileDoc.insertedId,
        filename: banner.name,
        contentType: banner.type,
        size: banner.size,
      };
    }

    const logo = formData.get('logo');
    if (logo && logo.size > 0) {
      const buffer = Buffer.from(await logo.arrayBuffer());
      const fileDoc = await db.collection('agent_files').insertOne({
        filename: logo.name,
        contentType: logo.type,
        size: logo.size,
        data: new Binary(buffer),
        uploadedAt: new Date(),
      });
      fileRefs.logo = {
        fileId: fileDoc.insertedId,
        filename: logo.name,
        contentType: logo.type,
        size: logo.size,
      };
    }

    data.files = fileRefs;

    const result = await db.collection('agent_requests').insertOne(data);

    console.log(`[novo-agente] Submission saved: ${result.insertedId}`);

    return Response.json(
      {
        success: true,
        id: result.insertedId.toString(),
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
