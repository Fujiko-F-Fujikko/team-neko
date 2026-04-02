import { CatState } from '../types'
import './Cat.css'

interface CatProps {
  state: CatState
  name?: string
  color?: string
  fast?: boolean
}

export default function Cat({ state, name, color = '#555', fast = false }: CatProps) {
  const classes = [
    'cat-container',
    `state-${state}`,
    fast ? 'speed-fast' : ''
  ].filter(Boolean).join(' ')

  const style = { '--cat-color': color } as React.CSSProperties

  return (
    <div className={classes} style={style}>
      <div className="cat-ears">
        <div className="cat-ear" style={{ borderBottomColor: color }}>
          <div className="cat-ear-inner" />
        </div>
        <div className="cat-ear" style={{ borderBottomColor: color }}>
          <div className="cat-ear-inner" />
        </div>
      </div>
      <div className="cat-head" style={{ background: color }}>
        <div className="cat-eyes">
          <div className="cat-eye">
            <div className="cat-pupil" />
          </div>
          <div className="cat-eye">
            <div className="cat-pupil" />
          </div>
        </div>
        <div className="cat-nose" />
        <div className="cat-mouth">
          <div className="cat-mouth-line" />
          <div className="cat-mouth-line" />
        </div>
        <div className="cat-whiskers">
          <div className="cat-whisker-group">
            <div className="cat-whisker" />
            <div className="cat-whisker" />
          </div>
          <div className="cat-whisker-group">
            <div className="cat-whisker" />
            <div className="cat-whisker" />
          </div>
        </div>
      </div>
      <div className="cat-body" style={{ background: color }} />
      <div className="cat-paws">
        <div className="cat-paw" style={{ background: color }} />
        <div className="cat-paw" style={{ background: color }} />
      </div>
      <div className="cat-tail" style={{ borderBottomColor: color }} />
      <div className="cat-zzz">Z z z</div>
      {name && <div style={{ marginTop: 8, fontSize: 14, fontWeight: 'bold', color: '#333' }}>{name}</div>}
    </div>
  )
}
