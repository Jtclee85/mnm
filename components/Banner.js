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
        layout="fill"
        objectFit="cover"
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
        {/* ✨ [수정됨] 부제목 텍스트 변경 */}
        <p style={{ fontSize: '1.1rem', color: '#444', margin: '5px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>
          조사한 사회과 자료를 쉽고 재미있게 설명해주는 AI 친구
        </p>
      </div>
    </div>
  );
};

export default Banner;
