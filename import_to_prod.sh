#!/bin/sh

host="apps.choqtssrcwew.eu-west-1.rds.amazonaws.com"
database="kooragang38"
user="u1qu6ol63rpuso"

[ -z "$1" ] && echo "Usage: ./import_to_prod.sh /absolute/path/to/table_name.csv" && exit 1

path="$1"
filename=$(basename "$1")
tablename=$(echo "${filename%.*}" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')

read -p "is '$tablename' the desired table name? [yN]" -n 1 -r; echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1; fi

create=$(csvsql -i postgresql "$path" 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed -E 's/table /table sources./' | awk '!(NR%2){gsub(FS,"_");gsub("\\\.","_")}1' RS=\" ORS= | sed -E 's/varchar\([[:digit:]]+\)|decimal/text/g')

[ -z "$create" ] && echo "CREATE statement empty. Is the csv UTF-8 & well-formed?" && exit 1

psql -c "CREATE SCHEMA IF NOT EXISTS sources" -h $host -d $database -U $user
echo "CREATING TABLE USING:"
echo $create
psql -c "$create" -h $host -d $database -U $user
echo
echo "IMPORTING TO sources.$tablename"
psql -c "\copy sources."$tablename" FROM '$path' header csv;" -h $host -d $database -U $user
echo "DONE!"
