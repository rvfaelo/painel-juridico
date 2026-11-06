"""Regressoes de inicializacao local, sem dados reais ou fontes externas."""
import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import MagicMock, call, patch
from service.main import APP_VERSION, CONTRACT_VERSION, main

class LocalRuntimeTests(unittest.TestCase):
    def test_iniciador_reutiliza_mesma_versao_sem_parar_servico(self):
        info={"appVersion":APP_VERSION,"contractVersion":CONTRACT_VERSION}
        with patch("service.main.Server",side_effect=OSError), patch("service.main.request_status",return_value=info) as status, redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--port","9876"]),0)
            status.assert_called_once_with(9876)

    def test_iniciador_renova_versao_antiga_aguardando_liberar_porta(self):
        server=MagicMock()
        server.serve_forever.side_effect=KeyboardInterrupt
        info={"appVersion":"0.5.2","contractVersion":CONTRACT_VERSION}
        with patch("service.main.Server",side_effect=[OSError(),OSError(),server]) as factory, patch("service.main.request_status",side_effect=[info,{"status":"stopping"}]) as status, patch("service.main.time.sleep"), redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--port","9876"]),0)
            self.assertEqual(status.call_args_list,[call(9876),call(9876,"STOP")])
            self.assertEqual(factory.call_count,3)
            server.worker.start.assert_called_once()
            server.djen_worker.start.assert_called_once()
            server.server_close.assert_called_once()

    def test_iniciador_nao_interrompe_servico_com_contrato_incompativel(self):
        info={"appVersion":"0.0.1","contractVersion":-1}
        with patch("service.main.Server",side_effect=OSError), patch("service.main.request_status",return_value=info) as status, redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--port","9876"]),2)
            status.assert_called_once_with(9876)

    def test_iniciador_nao_interrompe_programa_desconhecido(self):
        with patch("service.main.Server",side_effect=OSError), patch("service.main.request_status",side_effect=RuntimeError("Porta ocupada")) as status, redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--port","9876"]),2)
            status.assert_called_once_with(9876)

    def test_servico_local_nao_admite_bind_publico(self):
        from service.main import Server
        with self.assertRaises(TypeError):
            Server(0,bind_host="0.0.0.0")
