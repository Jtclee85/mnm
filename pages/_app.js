import '../styles/globals.css'; // 1단계에서 만든 CSS 파일을 불러옵니다.

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;
