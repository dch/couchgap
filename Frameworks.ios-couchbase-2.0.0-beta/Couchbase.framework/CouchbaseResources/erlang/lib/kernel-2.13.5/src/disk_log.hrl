%%
%% %CopyrightBegin%
%% 
%% Copyright Ericsson AB 1997-2009. All Rights Reserved.
%% 
%% The contents of this file are subject to the Erlang Public License,
%% Version 1.1, (the "License"); you may not use this file except in
%% compliance with the License. You should have received a copy of the
%% Erlang Public License along with this software. If not, it can be
%% retrieved online at http://www.erlang.org/.
%% 
%% Software distributed under the License is distributed on an "AS IS"
%% basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
%% the License for the specific language governing rights and limitations
%% under the License.
%% 
%% %CopyrightEnd%
%%

-define(DISK_LOG_NAME_TABLE, disk_log_names).
-define(DISK_LOG_PID_TABLE, disk_log_pids).

%% File format version
-define(VERSION, 2).

%% HEADSZ is the size of the file header, 
%% HEADERSZ is the size of the item header ( = ?SIZESZ + ?MAGICSZ).
-define(HEADSZ, 8).
-define(SIZESZ, 4).
-define(MAGICSZ, 4).
-define(HEADERSZ, 8).
-define(MAGICHEAD, <<12,33,44,55>>).
-define(MAGICINT, 203500599).     %% ?MAGICHEAD = <<?MAGICINT:32>>
-define(BIGMAGICHEAD, <<98,87,76,65>>).
-define(BIGMAGICINT, 1649888321). %% ?BIGMAGICHEAD = <<?BIGMAGICINT:32>>
-define(MIN_MD5_TERM, 65528).% (?MAX_CHUNK_SIZE - ?HEADERSZ)

-define(MAX_FILES, 65000).
-define(MAX_BYTES, ((1 bsl 64) - 1)).
-define(MAX_CHUNK_SIZE, 65536).

%% Object defines
-define(LOGMAGIC, <<1,2,3,4>>). 
-define(OPENED, <<6,7,8,9>>).
-define(CLOSED, <<99,88,77,11>>).

%% Needed for the definition of fd()
%% Must use include_lib() so that we always can be sure to find
%% file.hrl. A relative path will not work in an installed system.
-include_lib("kernel/include/file.hrl").

%% Ugly workaround. If we are building the bootstrap compiler,
%% file.hrl does not define the fd() type.
-ifndef(FILE_HRL_).
-type fd() :: pid() | #file_descriptor{}.
-endif.

%%------------------------------------------------------------------------
%% Types -- alphabetically
%%------------------------------------------------------------------------

-type dlog_format()      :: 'external' | 'internal'.
-type dlog_format_type() :: 'halt_ext' | 'halt_int' | 'wrap_ext' | 'wrap_int'.
-type dlog_head()        :: 'none' | {'ok', binary()} | mfa().
-type dlog_mode()        :: 'read_only' | 'read_write'.
-type dlog_name()        :: atom() | string().
-type dlog_optattr()     :: 'name' | 'file' | 'linkto' | 'repair' | 'type'
                          | 'format' | 'size' | 'distributed' | 'notify'
                          | 'head' | 'head_func' | 'mode'.
-type dlog_options()     :: [{dlog_optattr(), any()}].
-type dlog_repair()      :: 'truncate' | boolean().
-type dlog_size()        :: 'infinity' | pos_integer()
                          | {pos_integer(), pos_integer()}.
-type dlog_status()      :: 'ok' | {'blocked', 'false' | [_]}. %QueueLogRecords
-type dlog_type()        :: 'halt' | 'wrap'.

%%------------------------------------------------------------------------
%% Records
%%------------------------------------------------------------------------

%% record of args for open
-record(arg, {name = 0,
	      version = undefined,
	      file = none         :: 'none' | string(),
	      repair = true       :: dlog_repair(),
	      size = infinity     :: dlog_size(),
	      type = halt         :: dlog_type(),
	      distributed = false :: 'false' | {'true', [node()]},
	      format = internal   :: dlog_format(),
	      linkto = self()     :: 'none' | pid(),
	      head = none,
	      mode = read_write   :: dlog_mode(),
	      notify = false      :: boolean(),
	      options = []        :: dlog_options()}).

-record(cache,                %% Cache for logged terms (per file descriptor).
        {fd       :: fd(),              %% File descriptor.
         sz = 0   :: non_neg_integer(),	%% Number of bytes in the cache.
         c = []   :: iodata()}          %% The cache.
        ).

-record(halt,				%% For a halt log.
	{fdc      :: #cache{},		%% A cache record.
	 curB     :: non_neg_integer(),	%% Number of bytes on the file.
	 size     :: dlog_size()}
	).

-record(handle,				%% For a wrap log.
	{filename :: file:filename(),	%% Same as log.filename
	 maxB     :: pos_integer(),	%% Max size of the files.
	 maxF     :: pos_integer() | {pos_integer(),pos_integer()},
				%% When pos_integer(), maximum number of files.
				%% The form {NewMaxF, OldMaxF} is used when the
				%% number of wrap logs are decreased. The files
				%% are not removed when the size is changed but
				%% next time the files are to be used, i.e next
				%% time the wrap log has filled the 
				%% Dir/Name.NewMaxF file.
	 curB     :: non_neg_integer(),	%% Number of bytes on current file.
	 curF     :: integer(), 	%% Current file number.
	 cur_fdc  :: #cache{}, 	 	%% Current file descriptor.
	 cur_name :: file:filename(),	%% Current file name for error reports.
	 cur_cnt  :: non_neg_integer(),	%% Number of items on current file,
					%% header inclusive.
	 acc_cnt  :: non_neg_integer(),	%% acc_cnt+cur_cnt is number of items
					%% written since the log was opened.
	 firstPos :: non_neg_integer(),	%% Start position for first item
	 				%% (after header).
	 noFull   :: non_neg_integer(),	%% Number of overflows since last
	 				%% use of info/1 on this log, or
					%% since log was opened if info/1
					%% has not yet been used on this log.
	 accFull  :: non_neg_integer()}	%% noFull+accFull is number of
					%% oveflows since the log was opened.
       ).

-record(log,
	{status = ok       :: dlog_status(),
	 name              :: dlog_name(), %% the key leading to this structure
	 blocked_by = none :: 'none' | pid(),	   %% pid of blocker
	 users = 0         :: non_neg_integer(),   %% non-linked users
	 filename          :: file:filename(),	   %% real name of the file
	 owners = []       :: [{pid(), boolean()}],%% [{pid, notify}]
	 type = halt	   :: dlog_type(),
	 format = internal :: dlog_format(),
	 format_type	   :: dlog_format_type(),
	 head = none,         %%  none | {head, H} | {M,F,A}
	                      %%  called when wraplog wraps
	 mode		   :: dlog_mode(),
	 size,                %% value of open/1 option 'size' (never changed)
	 extra             :: #halt{} | #handle{}, %% type of the log
	 version           :: integer()}	   %% if wrap log file
	).

-record(continuation,         %% Chunk continuation.
	{pid = self() :: pid(),
	 pos          :: non_neg_integer() | {integer(), non_neg_integer()},
	 b            :: binary() | [] | pos_integer()}
	).

-type dlog_cont() :: 'start' | #continuation{}.
