import tempfile
import unittest
from service.store import Store
from tests.test_service import cnj, movement, result


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.store.update_settings({'enabled':{'datajud':True,'djen':False}})
        self.store.sync_cases([{'id':'c1','cnj':cnj()}])
        self.finish(movement('old'))

    def finish(self, *events):
        self.store.enqueue(['c1'],['datajud'])
        job = self.store.claim(('datajud',))
        self.store.finish(job,result=result(*events))

    def test_baseline_is_not_notification_and_new_events_persist_after_seen(self):
        self.assertEqual(self.store.notifications()['events'],[])
        self.finish(movement('old'),movement('new',text='X'*900))
        rows=self.store.notifications()['events']
        self.assertEqual(len(rows),1)
        self.assertEqual(len(rows[0]['text']),300)
        self.assertEqual(len(self.store.notification_detail('datajud','new',cnj())['event']['text']),900)
        selection=[{'id':'new','source':'datajud','cnj':cnj()}]
        self.assertEqual(self.store.mark_notifications(selection,True)['count'],1)
        self.assertEqual(self.store.notifications()['events'][0]['seen'],1)
        self.store.mark_notifications(selection,False)
        self.assertEqual(self.store.summary()['unseen'],1)
        self.assertEqual(len(self.store.notifications()['events']),1)

    def test_validation_is_atomic_and_cannot_turn_baseline_into_novelty(self):
        self.finish(movement('old'),movement('new'))
        with self.assertRaises(ValueError):
            self.store.mark_notifications([{'id':'new','source':'datajud','cnj':cnj()},
                {'id':'missing','source':'datajud','cnj':cnj()}],True)
        self.assertEqual(self.store.summary()['unseen'],1)
        with self.assertRaises(ValueError):
            self.store.mark_notifications([{'id':'old','source':'datajud','cnj':cnj()}],False)
        with self.assertRaises(ValueError):
            self.store.notification_detail('datajud','new',cnj(2))

    def test_repeat_consultation_does_not_reorder_or_reopen_seen(self):
        self.finish(movement('old'),movement('new'))
        key=[{'id':'new','source':'datajud','cnj':cnj()}]
        self.store.mark_notifications(key,True)
        stamp=self.store.notifications()['events'][0]['last_seen']
        self.finish(movement('old'),movement('new'))
        row=self.store.notifications()['events'][0]
        self.assertEqual(row['last_seen'],stamp)
        self.assertEqual(row['seen'],1)
        self.finish(movement('old'),movement('new',text='Teor corrigido'))
        row=self.store.notifications()['events'][0]
        self.assertEqual(row['seen'],0)
        self.assertEqual(row['is_new'],1)

    def test_index_does_not_silently_drop_older_notifications(self):
        self.finish(movement('old'),*[movement('new:'+str(i)) for i in range(450)])
        self.assertEqual(len(self.store.notifications()['events']),450)


if __name__ == '__main__':
    unittest.main()
