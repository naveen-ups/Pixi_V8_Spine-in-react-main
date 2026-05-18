import { EffectsShowcase } from './components/EffectsShowcase'
import { SpinePlayerV8 } from './components/SPinePlayerV8'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        color: '#09d3ac',
        fontFamily: 'sans-serif'
      }}>
        <h1 style={{ margin: 0, fontWeight: 300, letterSpacing: '4px' }}>MODERN SPINE PIXI</h1>
        <p style={{ fontSize: '12px', opacity: 0.7 }}>POWERED BY VITE + PIXI v8</p>
      </div>
      
      

      <SpinePlayerV8
        skeletonUrl="/assets/spineboy-ess.json"
        atlasUrl="/assets/spineboy-ess.atlas"
        // animationName="run"
        // scale={0.4}
      />

      <EffectsShowcase />
    </div>
  )
}

export default App
