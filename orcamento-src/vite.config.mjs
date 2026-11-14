// R07: perfis isolados. A compilação de produção (padrão) é a única que escreve em ../orcamento (publicado pela
// allowlist do Pages). O perfil `teste` (vite build --mode teste, endereços só de 127.0.0.1 em .env.teste) escreve
// numa pasta fora da allowlist e ignorada pelo Git: nenhum código ou endereço de teste chega ao site publicado.
export const TESTE_OUT_DIR = '../docs/prototipos/calculadora-v05-r4/teste/app/orcamento';

export default ({ mode } = {}) => ({
  base: '/orcamento/',
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: mode === 'teste' ? TESTE_OUT_DIR : '../orcamento',
    emptyOutDir: true,
  },
});
