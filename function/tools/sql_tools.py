import boto3
import json
import psycopg2
import os

# Initialize a Secrets Manager client
secrets_manager = boto3.client('secretsmanager')

def get_db_connection():
    # Fetch variables
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")

    # Connect to the database
    connection = psycopg2.connect(
        user=USER,
        password=PASSWORD,
        host=HOST,
        port=PORT,
        dbname=DBNAME
    )
    return connection



def get_schema(schema_name: str = 'ReportingWithAIAgent') -> str:
    """
    Fetches the schema of all tables and columns within a specified database schema,
    including table and column descriptions.

    Parameters:
        schema_name (str): The name of the database schema to inspect. Defaults to 'ReportingWithAIAgent'.

    Returns:
        str: A JSON string representing tables with their descriptions, columns, data types, and column descriptions.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # A single, unified query to get table, column, and description data
            query = """
                SELECT
                    c.table_name,
                    obj_description(('"' || c.table_schema || '"."' || c.table_name || '"')::regclass) AS table_description,
                    c.column_name,
                    c.data_type,
                    col_description(('"' || c.table_schema || '"."' || c.table_name || '"')::regclass, c.ordinal_position) AS column_description
                FROM
                    information_schema.columns AS c
                INNER JOIN
                    information_schema.tables AS t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
                WHERE
                    c.table_schema = %s AND t.table_type = 'BASE TABLE'
                ORDER BY
                    c.table_name, c.ordinal_position;
            """
            cur.execute(query, (schema_name,))
            results = cur.fetchall()

            # Process the flat list of results into a structured dictionary
            tables_dict = {}
            for table_name, table_desc, col_name, col_type, col_desc in results:
                # If table is new, initialize it
                if table_name not in tables_dict:
                    tables_dict[table_name] = {
                        "description": table_desc or "No description provided.",
                        "columns": []
                    }
                # Append column info to the correct table
                tables_dict[table_name]["columns"].append({
                    "name": col_name,
                    "data_type": col_type,
                    "description": col_desc or "No description provided."
                })

            # Convert the dictionary to the final list structure
            schema_list = [
                {"table_name": name, **details} for name, details in tables_dict.items()
            ]

            return json.dumps(schema_list, indent=4, default=str)
    finally:
        conn.close()



def execute_sql(query: str) -> str:
    """
    Executes a read-only SQL SELECT query against the database and returns the results.

    Parameters:
        query (str): The SELECT SQL query to execute.

    Returns:
        str: A JSON string representing the query results or an error message.
    """
    if not query.strip().upper().startswith('SELECT'):
        return json.dumps({"error": "Invalid query. Only SELECT queries are allowed."})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                results = [dict(zip(columns, row)) for row in cur.fetchall()]
                return json.dumps(results, indent=4, default=str) # Added default=str for data types like dates
            else:
                return json.dumps([]) # Handle queries that return no results
    except Exception as e:
        return json.dumps({"error": f"Query execution failed: {str(e)}"})
    finally:
        conn.close()