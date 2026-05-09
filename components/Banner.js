import Image from 'next/image';
import bannerImage from '../public/banner-background.png';

const Banner = () => {
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
        alt="뭐냐면 챗봇 배너"
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
        <h1 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 'bold', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>뭐냐면</h1>
        <p style={{ fontSize: '1rem', color: '#444', margin: '6px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)', fontWeight: 700 }}>
          사회과 조사학습 AI코스웨어
        </p>
        <p style={{ fontSize: '0.9rem', color: '#555', margin: '3px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>
          자료조사, 탐구, 발표준비 도우미
        </p>
      </div>
    </div>
  );
};

export default Banner;
