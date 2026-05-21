import socketio 
import logging 

logger =logging .getLogger (__name__ )

class ConnectionManager :

    def __init__ (self ):

        self .customer_sids :dict [str ,dict ]={}
        self .staff_sids :dict [str ,dict ]={}
        self .admin_sids :set [str ]=set ()

        self .customer_id_to_sid :dict [str ,str ]={}
        self .staff_id_to_sid :dict [str ,str ]={}

    def add_customer (self ,sid :str ,customer_id :str ,session_token :str ):
        self .customer_sids [sid ]={
        "customer_id":customer_id ,
        "session_token":session_token ,
        "conversation_id":None ,
        }
        self .customer_id_to_sid [customer_id ]=sid 
        logger .info (f"Customer {customer_id } connected (sid={sid })")

    def set_customer_conversation (self ,sid :str ,conversation_id :str ):
        if sid in self .customer_sids :
            self .customer_sids [sid ]["conversation_id"]=conversation_id 

    def remove_customer (self ,sid :str )->dict |None :
        data =self .customer_sids .pop (sid ,None )
        if data :
            self .customer_id_to_sid .pop (data ["customer_id"],None )
            logger .info (f"Customer {data ['customer_id']} disconnected (sid={sid })")
        return data 

    def get_customer_sid (self ,customer_id :str )->str |None :
        return self .customer_id_to_sid .get (customer_id )

    def get_customer_data (self ,sid :str )->dict |None :
        return self .customer_sids .get (sid )

    def add_staff (self ,sid :str ,user_id :str ,name :str ):
        self .staff_sids [sid ]={"user_id":user_id ,"name":name }
        self .staff_id_to_sid [user_id ]=sid 
        logger .info (f"Staff {name } ({user_id }) connected (sid={sid })")

    def remove_staff (self ,sid :str )->dict |None :
        data =self .staff_sids .pop (sid ,None )
        if data :
            self .staff_id_to_sid .pop (data ["user_id"],None )
            logger .info (f"Staff {data ['name']} disconnected (sid={sid })")
        return data 

    def get_staff_sid (self ,user_id :str )->str |None :
        return self .staff_id_to_sid .get (user_id )

    def get_staff_data (self ,sid :str )->dict |None :
        return self .staff_sids .get (sid )

    def add_admin (self ,sid :str ):
        self .admin_sids .add (sid )
        logger .info (f"Admin connected (sid={sid })")

    def remove_admin (self ,sid :str ):
        self .admin_sids .discard (sid )
        logger .info (f"Admin disconnected (sid={sid })")

    def get_admin_sids (self )->set [str ]:
        return self .admin_sids .copy ()

    def is_customer (self ,sid :str )->bool :
        return sid in self .customer_sids 

    def is_staff (self ,sid :str )->bool :
        return sid in self .staff_sids 

    def is_admin (self ,sid :str )->bool :
        return sid in self .admin_sids 

manager =ConnectionManager ()
