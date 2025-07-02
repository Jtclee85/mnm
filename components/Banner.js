import Image from 'next/image';
import bannerImage from '../public/제목 없는 디자인.png'; // 사용자가 업로드한 이미지 파일명

const Banner = () => {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '200px', // 배너 높이, 필요에 따라 조절하세요
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
        <p style={{ fontSize: '1.1rem', color: '#444', margin: '5px 0 0 0', textShadow: '1px 1px 3px rgba(255,255,255,0.5)' }}>
          조사한 원본 자료를 쉽고 재미있게 설명해주는 AI 친구
        </p>
      </div>
    </div>
  );
};

export default Banner;
