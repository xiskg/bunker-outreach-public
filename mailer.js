import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Creates a transporter dynamically using provided settings
function createTransporter(settings) {
  const host = settings.smtp_host || 'smtp.gmail.com';
  const port = parseInt(settings.smtp_port) || 465;
  const secure = settings.smtp_secure === 'true' || port === 465;
  const user = settings.smtp_user;
  const pass = settings.smtp_pass;

  if (!user || !pass) {
    throw new Error('SMTP user or password not configured in Settings.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

// Send cold email
export async function sendColdEmail(toEmail, subject, htmlBody, settings, candidateName = 'Candidato', userId = null) {
  if (process.env.DEMO_MODE === 'true') return {success: true, messageId: 'demo-simulated-no-delivery'};
  console.log(`\x1b[34m[EMAIL]\x1b[0m Preparando e-mail para: ${toEmail}`);

  try {
    const transporter = createTransporter(settings);

    const mailOptions = {
      from: `"${candidateName}" <${settings.smtp_user}>`,
      to: toEmail.toLowerCase(),
      subject: subject,
      html: htmlBody ? htmlBody.replace(/\n/g, '<br />') : '',
      attachments: []
    };

    // Check if user-specific CV PDF is uploaded and exists
    const userPdfPath = userId ? path.join(__dirname, 'uploads', `cv_${userId}.pdf`) : null;
    const globalPdfPath = path.join(__dirname, 'cv.pdf');

    let pdfPathToAttach = null;
    if (userPdfPath && fs.existsSync(userPdfPath)) {
      pdfPathToAttach = userPdfPath;
    } else if (fs.existsSync(globalPdfPath)) {
      pdfPathToAttach = globalPdfPath;
    }

    if (pdfPathToAttach) {
      const safeAttachmentName = `CV_${candidateName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      mailOptions.attachments.push({
        filename: safeAttachmentName,
        path: pdfPathToAttach
      });
      console.log(`\x1b[34m[EMAIL]\x1b[0m Currículo anexado: ${safeAttachmentName}`);
    } else {
      console.log('\x1b[33m[EMAIL WARNING]\x1b[0m Arquivo CV PDF não encontrado. Enviando sem anexo.');
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`\x1b[32m[EMAIL SUCCESS]\x1b[0m Enviado para ${toEmail}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`\x1b[31m[EMAIL ERROR]\x1b[0m Falha ao enviar para ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}
