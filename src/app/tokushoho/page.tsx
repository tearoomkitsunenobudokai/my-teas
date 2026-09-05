import Link from 'next/link'
import styles from '../legal.module.css'

/*
 * ポイントを有料で販売するにあたって必要な表記のページ。
 *
 * robots に noindex を指定しています。
 * 特定商取引法が求めているのは「消費者がアクセスできる状態にしておくこと」であり、
 * 検索エンジンに掲載することまでは求められていないため、
 * ページ自体は誰でも閲覧できる状態を保ったうえで、検索結果には出ないようにしています。
 * リンクは決済導線とフッターから辿れます。
 *
 * 運営統括責任者の氏名・住所・電話番号は
 * 「請求があった場合に遅滞なく開示する」方式で省略しています（特商法11条ただし書き）。
 * 消費者庁の通信販売広告Q&A（A15）では、請求があれば遅滞なく提供する旨を広告に表示し、
 * 実際に提供できる措置を講じている場合、事業者の氏名（名称）の表示も省略できるとされています。
 *
 * ★ 実際に請求があった場合は、遅滞なく開示する必要があります。
 *   「遅滞なく」とは、申込みの意思決定に先立って十分な時間的余裕をもって提供することを指します。
 *   すぐ回答できるよう、連絡先メールの受信を確認できる状態にしておいてください。
 *   対応できない状態が続くと、表示義務違反とみなされるおそれがあります。
 *
 * なお「販売事業者（屋号）」は省略していません。
 * 責任の所在を示す最低限の情報として残しています。
 */
export const metadata = {
  title: '特定商取引法に基づく表記 | My-Teas',
  robots: { index: false, follow: false },
}

export default function TokushohoPage() {
  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.back}>← My-Teas トップへ戻る</Link>
      <h1 className={styles.title}>特定商取引法に基づく表記</h1>

      <section className={styles.section}>
        <h2>販売事業者</h2>
        <p>狐の葡萄会</p>
      </section>

      <section className={styles.section}>
        <h2>運営統括責任者</h2>
        <p>
          ご請求をいただいた場合、遅滞なく開示いたします。
          下記のメールアドレスまでご連絡ください。
        </p>
      </section>

      <section className={styles.section}>
        <h2>所在地</h2>
        <p>
          ご請求をいただいた場合、遅滞なく開示いたします。
          下記のメールアドレスまでご連絡ください。
        </p>
      </section>

      <section className={styles.section}>
        <h2>連絡先</h2>
        <p>
          メールアドレス：tearoomkitsunenobudokai@gmail.com<br />
          電話番号：ご請求をいただいた場合、遅滞なく開示いたします。<br />
          お問い合わせは、上記のメールアドレスにて承ります。
        </p>
      </section>

      <section className={styles.section}>
        <h2>販売価格</h2>
        <p>
          各ポイントプランのページに表示された金額（消費税込み）といたします。
        </p>
      </section>

      <section className={styles.section}>
        <h2>商品代金以外に必要な料金</h2>
        <p>
          インターネット接続に必要な通信料金は、ユーザーのご負担となります。
        </p>
      </section>

      <section className={styles.section}>
        <h2>支払方法</h2>
        <p>
          クレジットカード、その他決済画面に表示される方法。
        </p>
      </section>

      <section className={styles.section}>
        <h2>支払時期</h2>
        <p>
          ご購入手続きの完了時に確定します。実際の引き落とし日は、
          ご利用の決済手段の規約に準じます。
        </p>
      </section>

      <section className={styles.section}>
        <h2>商品の引渡時期</h2>
        <p>
          決済の完了後、ただちにアカウントへポイントを付与します。
          通信状況等により、反映まで数分かかる場合があります。
        </p>
      </section>

      <section className={styles.section}>
        <h2>返品・キャンセルについて</h2>
        <p>
          商品の性質上、決済完了後の返品・キャンセルはお受けできません。
          ただし、システムの不具合によりポイントが付与されなかった場合は、
          お問い合わせいただければ確認のうえ対応いたします。
        </p>
      </section>

      <section className={styles.section}>
        <h2>ポイントの有効期限</h2>
        <p>
          購入したポイントに有効期限はありません。
          無償で付与されたポイント（初回特典・ログインボーナス等）には有効期限があり、
          ポイント画面に表示されます。
        </p>
        <p>
          ポイントの払い戻しは、法令で定められた場合を除き行いません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>表示事項の開示について</h2>
        <p>
          運営統括責任者の氏名、所在地および電話番号は、
          ご請求をいただいた場合、遅滞なく書面または電子メールにて開示いたします。
          下記のメールアドレスまでご連絡ください。
        </p>
        <p>
          メールアドレス：tearoomkitsunenobudokai@gmail.com
        </p>
      </section>

      <section className={styles.section}>
        <h2>動作環境</h2>
        <p>
          最新版のGoogle Chrome、Safari、Microsoft Edge のいずれかを推奨します。
        </p>
      </section>
    </div>
  )
}
