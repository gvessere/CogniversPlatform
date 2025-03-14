// cognivers-frontend/pages/_app.tsx
import { AppProps } from 'next/app'
import { ReactElement, ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import Layout from '../components/Layout'
import '../styles/globals.css'

type NextPageWithLayout = {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  // Check if the page has a getLayout function
  const getLayout = Component.getLayout || ((page) => <Layout>{page}</Layout>)

  return (
    <AuthProvider>
      {getLayout(<Component {...pageProps} />)}
    </AuthProvider>
  )
}

export default MyApp