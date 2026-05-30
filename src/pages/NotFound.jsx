import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './NotFound.module.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.code}>404</div>
          <h1 className={styles.h1}>Page not found</h1>
          <p className={styles.sub}>The page you're looking for doesn't exist or has been moved.</p>
          <div className={styles.actions}>
            <button className="btn-primary" onClick={() => navigate('/')}>Back to home</button>
            <button className="btn-text" onClick={() => navigate(-1)}>Go back</button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
