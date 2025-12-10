import { NextRequest, NextResponse } from 'next/server';
import { setupTOTPMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';
import QRCode from 'qrcode';

/**
 * POST /api/auth/mfa/totp/setup
 * Setup TOTP MFA for authenticated user
 * Returns QR code as base64 data URL for scanning
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await setupTOTPMFA(auth.userId, auth.email);

    // Generate QR code as data URL
    let qrCodeDataUrl: string | undefined;
    if (result.qrCodeUrl) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(result.qrCodeUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      } catch (qrError) {
        console.error('QR code generation error:', qrError);
      }
    }

    return NextResponse.json({
      id: result.id,
      type: result.type,
      secret: result.secret,
      qrCodeUrl: result.qrCodeUrl,
      qrCodeDataUrl,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup TOTP MFA' },
      { status: 500 }
    );
  }
}
