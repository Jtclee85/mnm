import Image from 'next/image';
import bannerImage from '../public/banner-background.png';
import { getUiText } from '../lib/i18n';

const Banner = ({ t = getUiText('ko') }) => {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '200px',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '1.5rem',
      textAlign: 'center',
      color: '#333'
    }}>
      <Image
        src={bannerImage}
        alt={t.bannerAlt}
        fill
        style={{ objectFit: 'cover' }}
        priority
      />
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%'
      }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 'bold', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>{t.brandName}</h1>
        <p style={{ fontSize: '1rem', color: '#444', margin: '6px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)', fontWeight: 700 }}>
          {t.bannerSubtitle}
        </p>
        <p style={{ fontSize: '0.9rem', color: '#555', margin: '3px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>
          {t.bannerDescription}
        </p>
      </div>
    </div>
  );
};

export default Banner;
